# ⚡ Features & Capabilities

This document outlines the current capabilities and feature set of **static-website-uploader**.

---

## 🤖 1. AI Agent & Model Context Protocol (MCP)

- **Official MCP Server (`@airtifact/mcp`)**:
  - Out-of-the-box support for AI agents (Cursor, Claude Code, Antigravity, Windsurf, Claude Desktop, etc.).
  - Runs locally via `npx @airtifact/mcp` over standard JSON-RPC (`stdio`).
- **`publish_site` Tool**:
  - Accepts an absolute local directory path containing static files (with an `index.html` at root).
  - Automatically filters out bulky/unnecessary files (`.git`, `node_modules`, `.next`, `dist`, `.DS_Store`, hidden files).
  - In-memory ZIP compilation and streaming upload to backend.
  - Returns formatted markdown with the shareable live URL and removal link directly to agent context.
- **`list_sites` Tool**:
  - Allows agents to query and inspect all static websites published under the user's account with live links and upload timestamps.
- **Configurable Connection Options**:
  - Supports environment variables (`STATIC_WEBSITE_UPLOADER_URL`, `STATIC_WEBSITE_UPLOADER_AUTH_TOKEN`) or explicit per-tool-call parameters.

---

## 🌐 2. Web UI & Drag-and-Drop Publishing

- **Modern Interactive Drag & Drop**:
  - Clean web interface built with Next.js 16 (App Router), Tailwind CSS, and shadcn/ui components.
  - Real-time client-side ZIP file inspection and validation before upload.
- **Instant Deployment**:
  - Instant extraction and hosting on Vercel Blob storage.
  - Provides a permanent shareable URL (`https://<domain>/<projectId>`) and instant preview.
- **Self-Service Project Removal**:
  - Each upload generates a dedicated delete token and removal URL (`/remove/<projectId>?token=...`) allowing users to easily delete their own uploads.

---

## 🔐 3. User Authentication & Multi-Tenancy

- **Programmatic API / Auth Tokens**:
  - Users can generate and manage multiple named Bearer auth tokens.
  - Secure token hashing for CLI and MCP tool access.
- **Configurable Tiered Upload Limits**:
  - Distinct size caps for anonymous vs. authenticated users (defaults: 5 MB anonymous / 50 MB authenticated, configurable via environment variables).
- **User Project Dashboard**:
  - Authenticated users can view their active deployments, file sizes, creation dates, and manage their uploaded sites.

---

## 🛠️ 4. Administration & Operations

- **Admin Management Portal (`/admin`)**:
  - Password-protected dashboard with session-based authentication.
  - Global overview of all deployed projects across the entire system.
  - Direct deletion and cleanup controls for any hosted project.
  - User account management and storage usage monitoring.
- **Security & Safety Guardrails**:
  - Cryptographically secure random project IDs.
  - Strict file MIME type and path traversal sanitization during ZIP extraction.
  - Rate limiting and upload payload size enforcement.

---

## 📦 5. Architecture & Monorepo

- **Monorepo Setup (pnpm workspaces)**:
  - `apps/web`: Full-stack Next.js web application and REST API.
  - `packages/mcp-server`: Standalone, distributable NPM package for the MCP server.
- **Serverless & Scalable**:
  - Backed by Vercel Blob storage for fast global asset delivery without maintaining dedicated file servers.
