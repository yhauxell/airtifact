import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin || 'https://airtifact.page';

  const mcpManifest = {
    name: 'airtifact',
    what: 'MCP server and universal static deployment hub for AI coding agents — deploy live preview links directly from agent workspaces.',
    protocol: 'Model Context Protocol',
    transport: 'stdio',
    package: '@airtifact/mcp',
    endpoint: `${origin}/api/mcp`,
    instructions: `airtifact — universal static website, Markdown docset & artifact preview hub for AI coding agents.
When you build or modify web artifacts, landing pages, interactive apps, HTML mockups, or Markdown documentation:
1. For HTML sites: Ensure the directory contains an 'index.html' file at its root and call 'publish_site'.
2. For Markdown docs: Call 'publish_markdown' with a single '.md' file path, a directory of '.md' files, or raw Markdown content (or POST /api/upload).
3. Share the resulting live URL with the user.
4. Use 'list_sites' to view all active deployed artifacts and their live links.
Full agent guidelines: ${origin}/skill.md`,
    auth: 'API Key / Auth Token sent as `Authorization: Bearer <API_KEY>` or configured via `AIRTIFACT_AUTH_TOKEN` environment variable.',
    tools: [
      {
        name: 'publish_site',
        title: 'Publish static website or docset directory',
        description:
          'Publishes a local directory containing a static website (with index.html at root) or Markdown documentation folder to airtifact to get a live preview URL.',
        requiresAuth: true,
        parameters: {
          directoryPath: {
            type: 'string',
            description:
              'The absolute path to the local directory containing the static website or Markdown files to upload.',
            required: true,
          },
          serverUrl: {
            type: 'string',
            description: `Target airtifact server URL (defaults to ${origin}).`,
            required: false,
          },
          authToken: {
            type: 'string',
            description:
              'API Auth Token for authorization (defaults to AIRTIFACT_AUTH_TOKEN environment variable).',
            required: false,
          },
        },
      },
      {
        name: 'publish_markdown',
        title: 'Publish Markdown document or docset (zero-build)',
        description:
          'Zero-build Markdown publishing. Publishes a single .md file, a directory of .md docs, or raw Markdown text directly into a styled web page with GFM, syntax highlighting, KaTeX math, Mermaid diagrams, and automatic sidebar navigation.',
        requiresAuth: true,
        parameters: {
          path: {
            type: 'string',
            description:
              'Local path to a single .md file OR a folder of Markdown files. Required unless markdown is provided.',
            required: false,
          },
          markdown: {
            type: 'string',
            description:
              'Raw Markdown string content to publish directly without writing to disk. Required unless path is provided.',
            required: false,
          },
          title: {
            type: 'string',
            description: 'Optional title for the published document or docset.',
            required: false,
          },
          serverUrl: {
            type: 'string',
            description: `Target airtifact server URL (defaults to ${origin}).`,
            required: false,
          },
          authToken: {
            type: 'string',
            description:
              'API Auth Token for authorization (defaults to AIRTIFACT_AUTH_TOKEN environment variable).',
            required: false,
          },
        },
      },
      {
        name: 'list_sites',
        title: 'List published websites and documents',
        description:
          'Lists all published static websites, Markdown documents, and preview links owned by the authenticated user.',
        requiresAuth: true,
        parameters: {
          serverUrl: {
            type: 'string',
            description: `Target airtifact server URL (defaults to ${origin}).`,
            required: false,
          },
          authToken: {
            type: 'string',
            description:
              'API Auth Token for authorization (defaults to AIRTIFACT_AUTH_TOKEN environment variable).',
            required: false,
          },
        },
      },
    ],
    connect: {
      claudeCode: 'claude mcp add airtifact -- npx -y @airtifact/mcp',
      config: {
        mcpServers: {
          airtifact: {
            command: 'npx',
            args: ['-y', '@airtifact/mcp'],
            env: {
              AIRTIFACT_URL: origin,
              AIRTIFACT_AUTH_TOKEN: '<YOUR_API_AUTH_TOKEN>',
            },
          },
        },
      },
    },
    docs: {
      skill: `${origin}/skill.md`,
      howToDeploy: `${origin}/#snippets`,
      restApi: `${origin}/api/upload`,
      dashboard: `${origin}/dashboard`,
      repo: 'https://github.com/yhauxell/airtifact',
    },
  };

  return NextResponse.json(mcpManifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
