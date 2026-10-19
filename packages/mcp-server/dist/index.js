#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { promises as fsPromises, existsSync, statSync } from "fs";
import * as path from "path";
import JSZip from "jszip";
import * as dotenv from "dotenv";
// Load environment variables from .env if present
dotenv.config();
function isPublishSiteToolArgs(args) {
    return (args &&
        typeof args === "object" &&
        typeof args.directoryPath === "string" &&
        (args.serverUrl === undefined || typeof args.serverUrl === "string") &&
        (args.authToken === undefined || typeof args.authToken === "string"));
}
function isPublishMarkdownToolArgs(args) {
    return (args &&
        typeof args === "object" &&
        (typeof args.path === "string" || typeof args.markdown === "string") &&
        (args.path === undefined || typeof args.path === "string") &&
        (args.markdown === undefined || typeof args.markdown === "string") &&
        (args.title === undefined || typeof args.title === "string") &&
        (args.serverUrl === undefined || typeof args.serverUrl === "string") &&
        (args.authToken === undefined || typeof args.authToken === "string"));
}
function isListSitesToolArgs(args) {
    return (!args ||
        typeof args !== "object" ||
        ((args.serverUrl === undefined || typeof args.serverUrl === "string") &&
            (args.authToken === undefined || typeof args.authToken === "string")));
}
/**
 * Recursively adds directory contents to a JSZip instance
 */
async function addDirectoryToZip(zip, rootPath, currentPath) {
    const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
    let mdCount = 0;
    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);
        // Skip common folders to avoid bloated uploads
        if (entry.name === ".git" ||
            entry.name === "node_modules" ||
            entry.name === ".next" ||
            entry.name === "dist" ||
            entry.name === ".DS_Store" ||
            entry.name.startsWith(".")) {
            continue;
        }
        if (entry.isDirectory()) {
            mdCount += await addDirectoryToZip(zip, rootPath, fullPath);
        }
        else if (entry.isFile()) {
            const fileContent = await fsPromises.readFile(fullPath);
            // Normalize path separators to forward slashes for ZIP compliance
            const zipPath = relativePath.split(path.sep).join("/");
            zip.file(zipPath, fileContent);
            if (/\.(md|markdown)$/i.test(entry.name)) {
                mdCount++;
            }
        }
    }
    return mdCount;
}
class MCPUploaderServer {
    server;
    constructor() {
        this.server = new Server({
            name: "@airtifact/mcp",
            version: "1.1.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupTools();
        // Error handling
        this.server.onerror = (error) => console.error("[MCP Error]", error);
        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupTools() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "publish_site",
                        description: "Publishes a local directory containing a static website (with index.html at root) or Markdown documentation folder to the web uploader service.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                directoryPath: {
                                    type: "string",
                                    description: "The absolute path to the local directory containing the static website or Markdown files to upload.",
                                },
                                serverUrl: {
                                    type: "string",
                                    description: "Airtifact Server URL. Optional. Defaults to AIRTIFACT_URL environment variable or https://airtifact.page.",
                                },
                                authToken: {
                                    type: "string",
                                    description: "Auth Token for authorization. Optional. Defaults to AIRTIFACT_AUTH_TOKEN environment variable.",
                                },
                            },
                            required: ["directoryPath"],
                        },
                    },
                    {
                        name: "publish_markdown",
                        description: "Zero-build Markdown publishing. Publishes a single Markdown (.md) file, a multi-file Markdown documentation directory, or raw Markdown content directly into a rendered web page with GFM, syntax highlighting, KaTeX math, Mermaid diagrams, and automatic sidebar navigation.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: "The local path to a single .md file OR a directory of .md documentation files to publish. Required unless 'markdown' is provided.",
                                },
                                markdown: {
                                    type: "string",
                                    description: "Raw Markdown string content to publish directly without writing to disk. Required unless 'path' is provided.",
                                },
                                title: {
                                    type: "string",
                                    description: "Optional title for the published document or documentation collection.",
                                },
                                serverUrl: {
                                    type: "string",
                                    description: "Airtifact Server URL. Optional. Defaults to AIRTIFACT_URL environment variable or https://airtifact.page.",
                                },
                                authToken: {
                                    type: "string",
                                    description: "Auth Token for authorization. Optional. Defaults to AIRTIFACT_AUTH_TOKEN environment variable.",
                                },
                            },
                        },
                    },
                    {
                        name: "list_sites",
                        description: "Lists all published static websites and Markdown documents owned by the authenticated user.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                serverUrl: {
                                    type: "string",
                                    description: "Airtifact Server URL. Optional. Defaults to AIRTIFACT_URL environment variable or https://airtifact.page.",
                                },
                                authToken: {
                                    type: "string",
                                    description: "Auth Token for authorization. Optional. Defaults to AIRTIFACT_AUTH_TOKEN environment variable.",
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
            if (toolName === "publish_site" || toolName === "publish_static_site") {
                return this.handlePublishSite(request.params.arguments);
            }
            else if (toolName === "publish_markdown") {
                return this.handlePublishMarkdown(request.params.arguments);
            }
            else if (toolName === "list_sites" || toolName === "list_projects") {
                return this.handleListSites(request.params.arguments);
            }
            else {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
            }
        });
    }
    resolveTargetCredentials(serverUrl, authToken) {
        const targetServerUrl = serverUrl ||
            process.env.AIRTIFACT_URL ||
            process.env.STATIC_WEBSITE_UPLOADER_URL ||
            "https://airtifact.page";
        const targetAuthToken = authToken ||
            process.env.AIRTIFACT_AUTH_TOKEN ||
            process.env.AIRTIFACT_API_KEY ||
            process.env.STATIC_WEBSITE_UPLOADER_AUTH_TOKEN ||
            process.env.STATIC_WEBSITE_UPLOADER_API_KEY;
        return { targetServerUrl, targetAuthToken };
    }
    async handlePublishSite(args) {
        if (!isPublishSiteToolArgs(args)) {
            throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for publish_site.");
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
            // 2. Resolve API URL and Key
            const { targetServerUrl, targetAuthToken } = this.resolveTargetCredentials(serverUrl, authToken);
            if (!targetAuthToken) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Auth Token is required for programmatic uploads. Please provide the 'authToken' argument or set the AIRTIFACT_AUTH_TOKEN environment variable.",
                        },
                    ],
                    isError: true,
                };
            }
            // 3. Create the ZIP file in memory
            console.error(`Packing files from ${absoluteDir}...`);
            const zip = new JSZip();
            const mdCount = await addDirectoryToZip(zip, absoluteDir, absoluteDir);
            const indexHtmlPath = path.join(absoluteDir, "index.html");
            const hasIndexHtml = existsSync(indexHtmlPath);
            if (!hasIndexHtml && mdCount === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: The directory '${absoluteDir}' must contain an 'index.html' file or at least one Markdown (.md) file.`,
                        },
                    ],
                    isError: true,
                };
            }
            const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
            // 4. Send POST request to upload endpoint
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
            return this.formatUploadResponse(response, targetServerUrl);
        }
        catch (error) {
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
    async handlePublishMarkdown(args) {
        if (!isPublishMarkdownToolArgs(args)) {
            throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for publish_markdown. Provide either 'path' (to a .md file or directory) or 'markdown' (raw Markdown string).");
        }
        try {
            const { path: inputPath, markdown, title, serverUrl, authToken } = args;
            const { targetServerUrl, targetAuthToken } = this.resolveTargetCredentials(serverUrl, authToken);
            if (!targetAuthToken) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Auth Token is required for programmatic uploads. Please provide the 'authToken' argument or set the AIRTIFACT_AUTH_TOKEN environment variable.",
                        },
                    ],
                    isError: true,
                };
            }
            const formData = new FormData();
            if (title) {
                formData.append("title", title);
            }
            if (markdown && !inputPath) {
                formData.append("markdown", markdown);
                formData.append("fileName", title ? `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md` : "index.md");
            }
            else if (inputPath) {
                const absoluteTarget = path.resolve(inputPath);
                if (!existsSync(absoluteTarget)) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: The path '${absoluteTarget}' does not exist.`,
                            },
                        ],
                        isError: true,
                    };
                }
                const stats = statSync(absoluteTarget);
                if (stats.isFile()) {
                    if (!/\.(md|markdown)$/i.test(absoluteTarget)) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Error: The file '${absoluteTarget}' must be a Markdown (.md or .markdown) file.`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    const fileContent = await fsPromises.readFile(absoluteTarget);
                    const fileName = path.basename(absoluteTarget);
                    const blob = new Blob([fileContent], { type: "text/markdown" });
                    formData.append("file", blob, fileName);
                }
                else if (stats.isDirectory()) {
                    const zip = new JSZip();
                    const mdCount = await addDirectoryToZip(zip, absoluteTarget, absoluteTarget);
                    if (mdCount === 0) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Error: The directory '${absoluteTarget}' does not contain any Markdown (.md) files.`,
                                },
                            ],
                            isError: true,
                        };
                    }
                    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
                    const zipName = `${path.basename(absoluteTarget) || "docs"}.zip`;
                    const blob = new Blob([zipBuffer], { type: "application/zip" });
                    formData.append("file", blob, zipName);
                }
                else {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: Unsupported path type at '${absoluteTarget}'.`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
            const uploadEndpoint = `${targetServerUrl.replace(/\/+$/, "")}/api/upload`;
            console.error(`Publishing Markdown to ${uploadEndpoint}...`);
            const response = await fetch(uploadEndpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${targetAuthToken}`,
                },
                body: formData,
            });
            return this.formatUploadResponse(response, targetServerUrl, true);
        }
        catch (error) {
            console.error("Error publishing markdown:", error);
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
    async formatUploadResponse(response, targetServerUrl, isMarkdownTool = false) {
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        }
        catch {
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
        const heading = isMarkdownTool || result.projectType === "markdown"
            ? "### 📄 Markdown Published Successfully!"
            : "### 🎉 Website Published Successfully!";
        const markdownOutput = `
${heading}

- **Project ID**: \`${result.projectId}\`
- **Project Type**: \`${result.projectType || "html"}\`
- **Files Packed**: ${result.files.length} file${result.files.length === 1 ? "" : "s"}
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
    }
    async handleListSites(args) {
        if (!isListSitesToolArgs(args)) {
            throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for list_sites.");
        }
        try {
            const { serverUrl, authToken } = args || {};
            const { targetServerUrl, targetAuthToken } = this.resolveTargetCredentials(serverUrl, authToken);
            if (!targetAuthToken) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Auth Token is required to list sites. Please provide the 'authToken' argument or set the AIRTIFACT_AUTH_TOKEN environment variable.",
                        },
                    ],
                    isError: true,
                };
            }
            const listEndpoint = `${targetServerUrl.replace(/\/+$/, "")}/api/user/projects`;
            console.error(`Fetching user sites from ${listEndpoint}...`);
            const response = await fetch(listEndpoint, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${targetAuthToken}`,
                },
            });
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            }
            catch {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to list sites. Server responded with status ${response.status} but invalid JSON: ${responseText.substring(0, 500)}`,
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
                            text: `Failed to list sites (${response.status}): ${errorMsg}`,
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
                            text: "No published sites found for this account.",
                        },
                    ],
                };
            }
            let markdownOutput = `### 📁 Published Sites (${projects.length})\n\n`;
            for (const proj of projects) {
                const liveUrl = `${targetServerUrl.replace(/\/+$/, "")}/${proj.projectId}`;
                const dateStr = proj.uploadDate
                    ? new Date(proj.uploadDate).toLocaleString()
                    : "Unknown date";
                const badge = proj.projectType === "markdown" ? " [Markdown]" : "";
                markdownOutput += `- **${proj.title || proj.fileName || "Site"}**${badge} (\`${proj.projectId}\`)\n`;
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
        }
        catch (error) {
            console.error("Error listing sites:", error);
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
