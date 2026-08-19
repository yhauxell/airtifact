# @airtifact/mcp

An official Model Context Protocol (MCP) server that enables AI coding assistants (Claude Desktop, Cursor, Antigravity, Windsurf, etc.) to deploy local static websites and preview artifacts directly to the **Airtifact** (`airtifact.page`) service via API, and list user sites.

## Features

- **`publish_site` Tool**: Automatically packs a local folder (must contain `index.html`), zips it in memory, and deploys it programmatically to your uploader backend.
- **`list_sites` Tool**: Lists all static websites published by the authenticated user along with file counts, upload dates, and live URLs.
- **Smart Ignore Rules**: Excludes unnecessary folders (`.git`, `node_modules`, `.next`, `dist`) and hidden OS files (`.DS_Store`) during compression.
- **Rich Markdown Output**: Returns shareable live URLs and secret project removal URLs directly formatted for the AI agent context.

---

## Configuration in Agent Environments

To register this MCP server in your agentic workspace, add the configuration below to your environment's `mcp_config.json`:

### Example Configuration (using `npx`)

```json
{
  "mcpServers": {
    "airtifact": {
      "command": "npx",
      "args": [
        "-y",
        "@airtifact/mcp"
      ],
      "env": {
        "AIRTIFACT_URL": "https://airtifact.page",
        "AIRTIFACT_AUTH_TOKEN": "sk_your_generated_auth_token"
      }
    }
  }
}
```

*Note: Replace `AIRTIFACT_URL` with your target server URL and `AIRTIFACT_AUTH_TOKEN` with your auth token.*

---

## Tool API Reference

### 1. `publish_site`

Publishes a local directory containing a static website.

#### Input Schema / Arguments

- `directoryPath` (string, **required**): Absolute path to the local directory containing the static website files (must contain `index.html` at the root).
- `serverUrl` (string, *optional*): Target server URL (e.g. `https://airtifact.page` or `http://localhost:3000`). Overrides the `AIRTIFACT_URL` environment variable.
- `authToken` (string, *optional*): Auth token for authorization (`sk_username.version.signature`). Overrides the `AIRTIFACT_AUTH_TOKEN` environment variable.

#### Success Response Example

```json
{
  "content": [
    {
      "type": "text",
      "text": "### 🎉 Website Published Successfully!\n\n- **Project ID**: `044a4449ae784808785e1bb0ca4df372`\n- **Files Packed**: 3 files\n- **Shareable Live URL**: [https://airtifact.page/044a4449ae784808785e1bb0ca4df372](https://airtifact.page/044a4449ae784808785e1bb0ca4df372)\n- **Removal URL**: [https://airtifact.page/project/044a4449ae784808785e1bb0ca4df372/r?t=aa166a](https://airtifact.page/project/044a4449ae784808785e1bb0ca4df372/r?t=aa166a)\n\n*Make sure to save the Removal URL or the delete token (`aa166a`) if you want to delete this project later.*"
    }
  ]
}
```

---

### 2. `list_sites`

Lists all published static websites owned by the authenticated user.

#### Input Schema / Arguments

- `serverUrl` (string, *optional*): Target server URL. Overrides `AIRTIFACT_URL`.
- `authToken` (string, *optional*): Auth token for authorization. Overrides `AIRTIFACT_AUTH_TOKEN`.

#### Success Response Example

```json
{
  "content": [
    {
      "type": "text",
      "text": "### 📁 Published Sites (2)\n\n- **my-portfolio.zip** (`044a4449ae784808785e1bb0ca4df372`)\n  - **Live URL**: [https://airtifact.page/044a4449ae784808785e1bb0ca4df372](https://airtifact.page/044a4449ae784808785e1bb0ca4df372)\n  - **Files**: 3 files\n  - **Uploaded**: 8/17/2026, 12:00:00 PM"
    }
  ]
}
```

---

## Example Usage with AI Agents

### Prompting Your AI Assistant

> *"List all my uploaded static websites using the `list_sites` tool."*

or

> *"Build a single-page HTML portfolio in `./portfolio-site` and publish it using the `publish_site` tool."*

---

## Local Development & Monorepo Build

If building from the workspace source:

```bash
# Build the MCP server package
pnpm build:mcp
```

This compiles TypeScript source into executable ES Modules under `dist/index.js`.
