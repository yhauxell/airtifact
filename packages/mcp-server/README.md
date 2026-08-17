# @yhauxell/static-site-mcp-server

An official Model Context Protocol (MCP) server that enables AI coding assistants (Claude Desktop, Cursor, Antigravity, Windsurf, etc.) to deploy local static websites directly to the **Static Website Uploader** service via API.

## Features

- **`publish_static_site` Tool**: Automatically packs a local folder (must contain `index.html`), zips it in memory, and deploys it programmatically to your uploader backend.
- **Smart Ignore Rules**: Excludes unnecessary folders (`.git`, `node_modules`, `.next`, `dist`) and hidden OS files (`.DS_Store`) during compression.
- **Rich Markdown Output**: Returns shareable live URLs and secret project removal URLs directly formatted for the AI agent context.

---

## Configuration in Agent Environments

To register this MCP server in your agentic workspace, add the configuration below to your environment's `mcp_config.json`:

### Example Configuration (using `npx`)

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
        "STATIC_WEBSITE_UPLOADER_URL": "https://staticmarkup.vercel.app",
        "STATIC_WEBSITE_UPLOADER_AUTH_TOKEN": "sk_your_generated_auth_token"
      }
    }
  }
}
```

*Note: Replace `STATIC_WEBSITE_UPLOADER_URL` with your target server URL and `STATIC_WEBSITE_UPLOADER_AUTH_TOKEN` with your auth token.*

---

## Tool API Reference

### `publish_static_site`

Publishes a local directory containing a static website.

#### Input Schema / Arguments

- `directoryPath` (string, **required**): Absolute path to the local directory containing the static website files (must contain `index.html` at the root).
- `serverUrl` (string, *optional*): Target uploader server URL (e.g. `http://localhost:3000` or your Vercel deployment URL). Overrides the `STATIC_WEBSITE_UPLOADER_URL` environment variable.
- `authToken` (string, *optional*): Auth token for authorization (`sk_username.version.signature`). Overrides the `STATIC_WEBSITE_UPLOADER_AUTH_TOKEN` environment variable.

#### Success Response Example

```json
{
  "content": [
    {
      "type": "text",
      "text": "### 🎉 Website Published Successfully!\n\n- **Project ID**: `044a4449ae784808785e1bb0ca4df372`\n- **Files Packed**: 3 files\n- **Shareable Live URL**: [http://localhost:3000/044a4449ae784808785e1bb0ca4df372](http://localhost:3000/044a4449ae784808785e1bb0ca4df372)\n- **Removal URL**: [http://localhost:3000/project/044a4449ae784808785e1bb0ca4df372/r?t=aa166a](http://localhost:3000/project/044a4449ae784808785e1bb0ca4df372/r?t=aa166a)\n\n*Make sure to save the Removal URL or the delete token (`aa166a`) if you want to delete this project later.*"
    }
  ]
}
```

---

## Example Usage with AI Agents

### Prompting Your AI Assistant

> *"Build a single-page HTML portfolio for a software engineer in `./portfolio-site` and publish it using the `publish_static_site` tool."*

### Agent Workflow
1. The AI agent creates `./portfolio-site/index.html`, `./portfolio-site/styles.css`, and associated assets.
2. The agent executes `publish_static_site({ directoryPath: "/path/to/portfolio-site" })`.
3. The MCP server zips the folder, POSTs it to the uploader endpoint, and returns the live URL.
4. The AI agent presents the live URL directly in the chat interface!

---

## Local Development & Monorepo Build

If building from the workspace source:

```bash
# Build the MCP server package
pnpm --filter @yhauxell/static-site-mcp-server build
```

This compiles TypeScript source into executable ES Modules under `dist/index.js`.
