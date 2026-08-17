#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fsPromises, existsSync, statSync } from "fs";
import * as path from "path";
import JSZip from "jszip";
import * as dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

/**
 * Interface for the publish tool input arguments
 */
interface PublishToolArgs {
  directoryPath: string;
  serverUrl?: string;
  authToken?: string;
}

function isPublishToolArgs(args: any): args is PublishToolArgs {
  return (
    args &&
    typeof args === "object" &&
    typeof args.directoryPath === "string" &&
    (args.serverUrl === undefined || typeof args.serverUrl === "string") &&
    (args.authToken === undefined || typeof args.authToken === "string")
  );
}

/**
 * Interface for the list projects tool input arguments
 */
interface ListProjectsToolArgs {
  serverUrl?: string;
  authToken?: string;
}

function isListProjectsToolArgs(args: any): args is ListProjectsToolArgs {
  return (
    !args ||
    typeof args !== "object" ||
    ((args.serverUrl === undefined || typeof args.serverUrl === "string") &&
      (args.authToken === undefined || typeof args.authToken === "string"))
  );
}

/**
 * Recursively adds directory contents to a JSZip instance
 */
async function addDirectoryToZip(zip: JSZip, rootPath: string, currentPath: string) {
  const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath);

    // Skip common folders to avoid bloated uploads
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist" ||
      entry.name === ".DS_Store" ||
      entry.name.startsWith(".")
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, rootPath, fullPath);
    } else if (entry.isFile()) {
      const fileContent = await fsPromises.readFile(fullPath);
      // Normalize path separators to forward slashes for ZIP compliance
      const zipPath = relativePath.split(path.sep).join("/");
      zip.file(zipPath, fileContent);
    }
  }
}

class MCPUploaderServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "@yhauxell/static-site-mcp-server",
        version: "1.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "publish_static_site",
            description:
              "Publishes a local directory containing a static website (with index.html at root) to the web uploader service.",
            inputSchema: {
              type: "object",
              properties: {
                directoryPath: {
                  type: "string",
                  description:
                    "The absolute path to the local directory containing the static website files to upload.",
                },
                serverUrl: {
                  type: "string",
                  description:
                    "Static Website Server Url. Optional. Defaults to STATIC_WEBSITE_UPLOADER_URL environment variable or http://localhost:3000.",
                },
                authToken: {
                  type: "string",
                  description:
                    "Auth Token for authorization. Optional. Defaults to STATIC_WEBSITE_UPLOADER_AUTH_TOKEN environment variable.",
                },
              },
              required: ["directoryPath"],
            },
          },
          {
            name: "list_projects",
            description:
              "Lists all published static website projects owned by the authenticated user.",
            inputSchema: {
              type: "object",
              properties: {
                serverUrl: {
                  type: "string",
                  description:
                    "Static Website Server Url. Optional. Defaults to STATIC_WEBSITE_UPLOADER_URL environment variable or http://localhost:3000.",
                },
                authToken: {
                  type: "string",
                  description:
                    "Auth Token for authorization. Optional. Defaults to STATIC_WEBSITE_UPLOADER_AUTH_TOKEN environment variable.",
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;

      if (toolName === "publish_static_site") {
        return this.handlePublishStaticSite(request.params.arguments);
      } else if (toolName === "list_projects") {
        return this.handleListProjects(request.params.arguments);
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${toolName}`
        );
      }
    });
  }

  private async handlePublishStaticSite(args: any) {
    if (!isPublishToolArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for publish_static_site."
      );
    }

    try {
      const { directoryPath, serverUrl, authToken } = args;

      // 1. Resolve and validate directory
      const absoluteDir = path.resolve(directoryPath);
      if (!existsSync(absoluteDir)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: The directory path '${absoluteDir}' does not exist.`,
            },
          ],
          isError: true,
        };
      }

      const stats = statSync(absoluteDir);
      if (!stats.isDirectory()) {
        return {
          content: [
            {
              type: "text",
              text: `Error: The path '${absoluteDir}' is not a directory.`,
            },
          ],
          isError: true,
        };
      }

      // 2. Validate index.html exists
      const indexHtmlPath = path.join(absoluteDir, "index.html");
      if (!existsSync(indexHtmlPath)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: The directory '${absoluteDir}' must contain an 'index.html' file at the root.`,
            },
          ],
          isError: true,
        };
      }

      // 3. Resolve API URL and Key
      const targetServerUrl =
        serverUrl ||
        process.env.STATIC_WEBSITE_UPLOADER_URL ||
        "http://localhost:3000";

      const targetAuthToken =
        authToken ||
        process.env.STATIC_WEBSITE_UPLOADER_AUTH_TOKEN ||
        process.env.STATIC_WEBSITE_UPLOADER_API_KEY;

      if (!targetAuthToken) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Auth Token is required for programmatic uploads. Please provide the 'authToken' argument or set the STATIC_WEBSITE_UPLOADER_AUTH_TOKEN environment variable.",
            },
          ],
          isError: true,
        };
      }

      // 4. Create the ZIP file in memory
      console.error(`Packing files from ${absoluteDir}...`);
      const zip = new JSZip();
      await addDirectoryToZip(zip, absoluteDir, absoluteDir);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      // 5. Send POST request to upload endpoint
      const uploadEndpoint = `${targetServerUrl.replace(/\/+$/, "")}/api/upload`;
      console.error(`Uploading to ${uploadEndpoint}...`);

      const formData = new FormData();
      const zipName = `${path.basename(absoluteDir) || "website"}.zip`;
      const blob = new Blob([zipBuffer], { type: "application/zip" });
      formData.append("file", blob, zipName);

      const response = await fetch(uploadEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${targetAuthToken}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Upload failed. Server responded with status ${response.status} but invalid JSON: ${responseText.substring(0, 500)}`,
            },
          ],
          isError: true,
        };
      }

      if (!response.ok) {
        const errorMsg = result.error || responseText;
        return {
          content: [
            {
              type: "text",
              text: `Upload failed (${response.status}): ${errorMsg}`,
            },
          ],
          isError: true,
        };
      }

      const shareUrlAbsolute = `${targetServerUrl.replace(/\/+$/, "")}${result.shareUrl}`;
      const removeUrlAbsolute = `${targetServerUrl.replace(/\/+$/, "")}${result.removeUrl}`;

      const markdownOutput = `
### 🎉 Website Published Successfully!

- **Project ID**: \`${result.projectId}\`
- **Files Packed**: ${result.files.length} files
- **Shareable Live URL**: [${shareUrlAbsolute}](${shareUrlAbsolute})
- **Removal URL**: [${removeUrlAbsolute}](${removeUrlAbsolute})

*Make sure to save the Removal URL or the delete token (\`${result.deleteToken}\`) if you want to delete this project later.*
      `.trim();

      return {
        content: [
          {
            type: "text",
            text: markdownOutput,
          },
        ],
      };
    } catch (error: any) {
      console.error("Error publishing static site:", error);
      return {
        content: [
          {
            type: "text",
            text: `Internal MCP Server Error: ${error.message || String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListProjects(args: any) {
    if (!isListProjectsToolArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for list_projects."
      );
    }

    try {
      const { serverUrl, authToken } = args || {};

      const targetServerUrl =
        serverUrl ||
        process.env.STATIC_WEBSITE_UPLOADER_URL ||
        "http://localhost:3000";

      const targetAuthToken =
        authToken ||
        process.env.STATIC_WEBSITE_UPLOADER_AUTH_TOKEN ||
        process.env.STATIC_WEBSITE_UPLOADER_API_KEY;

      if (!targetAuthToken) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Auth Token is required to list projects. Please provide the 'authToken' argument or set the STATIC_WEBSITE_UPLOADER_AUTH_TOKEN environment variable.",
            },
          ],
          isError: true,
        };
      }

      const listEndpoint = `${targetServerUrl.replace(/\/+$/, "")}/api/user/projects`;
      console.error(`Fetching user projects from ${listEndpoint}...`);

      const response = await fetch(listEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${targetAuthToken}`,
        },
      });

      const responseText = await response.text();
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list projects. Server responded with status ${response.status} but invalid JSON: ${responseText.substring(0, 500)}`,
            },
          ],
          isError: true,
        };
      }

      if (!response.ok) {
        const errorMsg = result.error || responseText;
        return {
          content: [
            {
              type: "text",
              text: `Failed to list projects (${response.status}): ${errorMsg}`,
            },
          ],
          isError: true,
        };
      }

      const projects = result.projects || [];
      if (projects.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No published projects found for this account.",
            },
          ],
        };
      }

      let markdownOutput = `### 📁 Published Projects (${projects.length})\n\n`;
      for (const proj of projects) {
        const liveUrl = `${targetServerUrl.replace(/\/+$/, "")}/${proj.projectId}`;
        const dateStr = proj.uploadDate
          ? new Date(proj.uploadDate).toLocaleString()
          : "Unknown date";
        markdownOutput += `- **${proj.fileName || "Project"}** (\`${proj.projectId}\`)\n`;
        markdownOutput += `  - **Live URL**: [${liveUrl}](${liveUrl})\n`;
        markdownOutput += `  - **Files**: ${proj.fileCount || (proj.files ? proj.files.length : "N/A")} files\n`;
        markdownOutput += `  - **Uploaded**: ${dateStr}\n\n`;
      }

      return {
        content: [
          {
            type: "text",
            text: markdownOutput.trim(),
          },
        ],
      };
    } catch (error: any) {
      console.error("Error listing projects:", error);
      return {
        content: [
          {
            type: "text",
            text: `Internal MCP Server Error: ${error.message || String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Static Website Uploader MCP server running on stdio");
  }
}

const server = new MCPUploaderServer();
server.run().catch((error) => {
  console.error("Fatal error running MCP server:", error);
  process.exit(1);
});
