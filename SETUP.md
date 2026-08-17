# ZIP HTML Uploader - Setup & Deployment Guide

A super simple Next.js app that lets you upload ZIP files containing HTML sites and share them via private URLs, plus an official Model Context Protocol (MCP) server for AI agent integrations.

## Features

✅ **Drag-and-drop ZIP upload** - Beautiful UI with shadcn styling  
✅ **🤖 AI Agent Integration (MCP)** - Official `@yhauxell/static-site-mcp-server` package for AI agents to publish static sites directly via API  
✅ **Cryptographically secure private IDs** - Random 32-char hex IDs (impossible to guess)  
✅ **Vercel Blob storage** - Files stored as public blobs, accessible via project page or API  
✅ **Shareable links** - Get instant URLs to share with anyone  
✅ **Admin dashboard** - Password-protected `/admin` route lists and removes projects  
✅ **Asset serving** - CSS, JS, images, fonts all properly served with correct MIME types  
✅ **iframe rendering** - Projects displayed in isolated iframe with proper base URL handling

## Architecture

### File Storage: Vercel Blob
- Files stored with `access: 'public'` — directly accessible via their Vercel Blob CDN URL
- Path structure: `projects/{projectId}/{filename}`
- Project metadata stored in `projects/{projectId}/metadata.json`
- Files are also served via API route `/api/projects/[projectId]/[...path]`
- **Note:** Project confidentiality relies on the secrecy of the 32-character project ID. Anyone who knows the CDN URL of a file can access it directly without going through the app.

### Project IDs
- Generated using `crypto.randomBytes(16).toString('hex')` → 32-character hex strings
- Cryptographically secure, impossible to brute force
- Not sequential or predictable

### Serving Architecture
```
User / AI Agent → /{projectId} (Next.js page) → Fetches /index.html from Blob → Renders in iframe
                                               ↓
                                    <iframe src="..." base href="/{projectId}/">
                                    Assets load via /api/projects/{projectId}/{asset} → Blob
```

---

## Model Context Protocol (MCP) Server Integration

The repository includes `@yhauxell/static-site-mcp-server` under `packages/mcp-server`, published to npm so any MCP-compatible AI agent (Claude Desktop, Cursor, Antigravity, Windsurf, etc.) can publish static websites directly to your uploader.

### 1. Generating an Auth Token

To allow programmatic uploads from AI agents:
1. Log in to your hosted uploader instance (or local dev environment).
2. Generate an API Key / Auth Token (format: `sk_<username>.<version>.<signature>`).

### 2. Client Configuration

Add the server to your agent's MCP configuration (`mcp_config.json`):

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
        "STATIC_WEBSITE_UPLOADER_AUTH_TOKEN": "sk_your_generated_auth_token"
      }
    }
  }
}
```

### 3. Agent Tool: `publish_static_site`

When connected, agents can execute the `publish_static_site` tool with parameters:
- `directoryPath` (string, required): Path to the local directory containing an `index.html` file.
- `serverUrl` (string, optional): Target uploader server URL.
- `authToken` (string, optional): Auth token for authorization.

#### How It Works Under the Hood
1. The MCP server validates that `directoryPath` exists and contains `index.html`.
2. It packs the directory contents into a ZIP archive in memory (excluding `.git`, `node_modules`, `.next`, etc.).
3. It sends a `POST /api/upload` multipart request with `Authorization: Bearer <authToken>`.
4. It formats a Markdown response containing the live shareable URL for the AI agent to report to the user.

---

## Setup for Deployment

### 1. Connect Vercel Blob Integration

1. Go to your Vercel project settings
2. Add the Blob integration (if not already added)
3. The integration automatically creates `BLOB_READ_WRITE_TOKEN` environment variable

### 2. Deploy to Vercel

The web application is inside `apps/web`. Set the **Root Directory** in your Vercel project settings to `apps/web`.

```bash
# Deploy via Vercel CLI from apps/web or workspace root
vercel deploy
```

### 3. Verify Deployment

Once deployed:
- Visit your domain → Landing page with drag-and-drop upload
- Click upload or drag a ZIP file → Get a shareable link
- Visit the link → See your HTML rendered
- Visit `/admin` → Admin dashboard showing all projects

---

## Local Testing

### Development Setup

```bash
# Install workspace dependencies
pnpm install

# Start Next.js web application dev server
pnpm dev:web

# Build MCP server package
pnpm build:mcp
```

Navigate to `http://localhost:3000` to access the web UI.

---

## File Structure (Monorepo)

```
static-website-uploader/
├── pnpm-workspace.yaml                   # Monorepo workspace configuration
├── package.json                          # Root orchestration scripts
├── apps/
│   └── web/                              # Next.js Web App & REST API
│       ├── app/
│       │   ├── page.tsx                  # Landing page with upload UI
│       │   ├── admin/                    # Password-protected admin dashboard
│       │   ├── [projectId]/              # Project display (renders HTML)
│       │   └── api/
│       │       ├── upload/route.ts       # ZIP upload endpoint (web & API)
│       │       ├── admin/                # Admin auth & management APIs
│       │       └── projects/             # Serving files from Vercel Blob
│       ├── lib/                          # Auth & session logic
│       ├── public/                       # Static assets
│       ├── generate-hash.js              # Admin credential helper
│       └── package.json
└── packages/
    └── mcp-server/                       # @yhauxell/static-site-mcp-server
        ├── src/
        │   └── index.ts                  # MCP server & publish_static_site tool
        ├── README.md                     # MCP package docs
        └── package.json
```

---

## API Endpoints

### `POST /api/upload`
Upload a ZIP file (Web form or programmatic API).

**Headers:**
`Authorization: Bearer sk_<username>.<version>.<signature>` (or `X-Web-Client: true` for web session upload)

**Request:**
```
multipart/form-data
- file: File (must be .zip)
```

**Response:**
```json
{
  "projectId": "a1b2c3d4e5f6...",
  "shareUrl": "/a1b2c3d4e5f6...",
  "files": ["index.html", "style.css", "script.js"],
  "metadata": {
    "projectId": "...",
    "uploadDate": "2025-06-11T...",
    "fileName": "project.zip",
    "fileCount": 3,
    "files": [...]
  }
}
```

---

## Troubleshooting

### MCP Tool Error: "Auth Token is required for programmatic uploads"
- Ensure `STATIC_WEBSITE_UPLOADER_AUTH_TOKEN` is set in your agent's MCP config environment block or passed explicitly as the `authToken` parameter.

### MCP Tool Error: "directory must contain an index.html file"
- Make sure the folder being uploaded contains `index.html` directly in its root level (not nested inside a subfolder).

---

Built with Next.js 16, Vercel Blob, Model Context Protocol, and shadcn/ui. 🚀
