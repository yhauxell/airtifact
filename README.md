# static-website-uploader

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyhauxell%2Fstatic-website-uploader)

The universal, open-source deployment layer and artifact preview hub for AI coding agents. Upload static sites via drag-and-drop or let AI assistants (Cursor, Claude Code, Windsurf, Antigravity) deploy live preview links directly from their workspace via Model Context Protocol (MCP).

## Live Demo

🔗 https://staticmarkup.vercel.app/

## Features

- **Drag-and-drop ZIP upload UI**: Beautiful interface for instant web uploads.
- **🤖 AI Agent MCP Integration**: Official Model Context Protocol (`@yhauxell/static-site-mcp-server`) server for agentic environments to deploy static site artifacts via API.
- **Secure random IDs**: Project links generated using cryptographically secure random IDs.
- **Vercel Blob storage**: High-performance static asset hosting.
- **User Accounts & Auth Tokens**: Programmatic API keys / Auth Tokens for authenticated CLI & MCP uploads.
- **Admin dashboard**: Password-protected dashboard for managing projects and user accounts.
- **Self-service removal**: Delete token URLs for easy project removal.

## Repository Structure (Monorepo)

This repository is structured as a `pnpm` monorepo:

- **`apps/web`**: Next.js 16 web application and upload REST API.
- **`packages/mcp-server`** (`@yhauxell/static-site-mcp-server`): Model Context Protocol server enabling AI coding agents to deploy static sites directly from their workspace.

---

## 🤖 AI Agent MCP Integration

Plug the `@yhauxell/static-site-mcp-server` into your agentic tools (Claude Desktop, Cursor, Antigravity, Windsurf, etc.) to allow AI agents to deploy local static websites directly to your uploader backend.

### Quick Start with `npx`

Add the MCP server to your environment's `mcp_config.json`:

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
        "STATIC_WEBSITE_UPLOADER_AUTH_TOKEN": "your_auth_token_here"
      }
    }
  }
}
```

### Available MCP Tools

#### `publish_site`
Packs a local directory (must contain `index.html` at root), zips it in memory, and publishes it via API.

| Parameter | Type | Description |
| --- | --- | --- |
| `directoryPath` | `string` | **Required**. Absolute path to the directory containing static site files. |
| `serverUrl` | `string` | *Optional*. Target uploader server URL (defaults to `STATIC_WEBSITE_UPLOADER_URL` or `http://localhost:3000`). |
| `authToken` | `string` | *Optional*. API Auth Token (defaults to `STATIC_WEBSITE_UPLOADER_AUTH_TOKEN`). |

#### `list_sites`
Lists all published static websites owned by the authenticated user.

| Parameter | Type | Description |
| --- | --- | --- |
| `serverUrl` | `string` | *Optional*. Target uploader server URL. |
| `authToken` | `string` | *Optional*. API Auth Token. |

#### Example Agent Request
> *"Create a responsive landing page in `./my-landing-page` and publish it using `publish_site`."*
> *"List all my published sites using `list_sites`."*

---

## Getting Started

### 1) Clone the repository

```bash
git clone https://github.com/yhauxell/static-website-uploader.git
cd static-website-uploader
```

### 2) Install dependencies

```bash
pnpm install
```

### 3) Configure environment variables

Create `apps/web/.env.local` and set:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
SESSION_SECRET=your_session_secret
ADMIN_PASSWORD_HASH=your_secure_password_hash
# Optional, in bytes. Defaults to 5MB anon / 50MB auth when unset.
MAX_ANON_UPLOAD_SIZE_BYTES=5242880
MAX_AUTH_UPLOAD_SIZE_BYTES=52428800
```

#### Generating Admin Hash & Session Secret

Run the helper script to generate `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`:

```bash
node apps/web/generate-hash.js <your_admin_password>
```

### 4) Run the development servers

- **Web Application**:
  ```bash
  pnpm dev:web
  ```
  Open http://localhost:3000 in your browser.

- **MCP Server**:
  ```bash
  pnpm build:mcp
  ```

---

## Build for Production

```bash
# Build the Next.js web application
pnpm build:web

# Build the MCP server package
pnpm build:mcp
```

---

## Deployment & Setup

For full deployment details, architecture notes, and MCP troubleshooting, see:

- [SETUP.md](SETUP.md)
- [FEATURES.md](FEATURES.md)
- [ROADMAP.md](ROADMAP.md)
- [AGENT.md](AGENT.md)
- [packages/mcp-server/README.md](packages/mcp-server/README.md)

---

## Contributing

Contributions are welcome. Please keep pull requests focused and include a clear description of changes.

## License

MIT — see [LICENSE](LICENSE).