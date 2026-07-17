# @yhauxell/static-site-mcp-server

An MCP (Model Context Protocol) server that enables AI agents to deploy local static websites directly to the [Static Website Uploader](file:///Users/yausellruiz/projects/static-website-uploader/apps/web) service via the command line or from agentic IDE environments.

## Features

- **`publish_static_site` Tool**: Automatically packs a local folder (must contain `index.html`), zips it up in memory, and deploys it programmatically to your uploader backend.
- Automatically excludes unnecessary directories like `.git`, `node_modules`, `.next`, `dist`, and system files like `.DS_Store`.

---

## Installation & Setup

### 1. Build the MCP Server

Ensure you are at the workspace root, then run:

```bash
# Build the MCP server
pnpm --filter @yhauxell/static-site-mcp-server build
```

This compiles the typescript into executable ES Modules in `packages/mcp-server/dist/index.js`.

### 2. Obtain an API Key

Programmatic uploads require authentication. 
1. Run the Web uploader application locally or visit your hosted instance.
2. Sign in to your account.
3. Generate or retrieve an API Key (format: `sk_<username>.<version>.<signature>`) from your User Profile page or Developer API configuration page.

---

## Configuration in Agent Environments

To plug this MCP server into your agent environments (e.g., Claude Desktop, Antigravity, etc.), configure it in your `mcp_config.json` file.

### Example configuration (using `npx`)

Add the following to your MCP configuration settings file:

```json
{
  "mcpServers": {
    "static-site-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "@yhauxell/static-site-mcp-server"
      ],
      "env": {
        "STATIC_WEBSITE_UPLOADER_URL": "http://localhost:3000",
        "STATIC_WEBSITE_UPLOADER_AUTH_TOKEN": "YOUR_GENERATED_AUTH_TOKEN"
      }
    }
  }
}
```

*Note: Replace `YOUR_GENERATED_AUTH_TOKEN` with your actual auth token.*

---

## Tool API Reference

### `publish_static_site`

Publishes a local directory containing a static website.

#### Arguments

- `directoryPath` (string, **required**): Absolute path to the local directory containing the static files (e.g. `/Users/username/my-site`). Must contain an `index.html` file at the root.
- `serverUrl` (string, *optional*): The URL of the uploader service (e.g., `http://localhost:3000` or your Vercel deployment URL). Overrides the `STATIC_WEBSITE_UPLOADER_URL` environment variable.
- `authToken` (string, *optional*): The Auth Token for authorization. Overrides the `STATIC_WEBSITE_UPLOADER_AUTH_TOKEN` environment variable.

#### Success Response Example

```json
{
  "content": [
    {
      "type": "text",
      "text": "### 🎉 Website Published Successfully!\n\n- **Project ID**: `abc123xyz`\n- **Files Packed**: 5 files\n- **Shareable Live URL**: [http://localhost:3000/abc123xyz](http://localhost:3000/abc123xyz)\n- **Removal URL**: [http://localhost:3000/api/projects/abc123xyz/remove?token=...](...)"
    }
  ]
}
```
