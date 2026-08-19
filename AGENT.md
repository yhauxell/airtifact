# 🤖 AGENT.md — Context & Guidelines for AI Coding Agents

Welcome, Agent. This document serves as your operational manual and architectural guardrail when working on the **`static-website-uploader`** codebase.

---

## 🎯 Macro Goal & Core Positioning

> **Macro Goal**: Build and maintain the premier **open-source, universal deployment and artifact hub for AI coding agents**.
>
> Every tool, API route, and UX flow must prioritize **frictionless, deterministic, and autonomous agent workflows**—bridging the gap between local code generation and instant, shareable live previews across any AI assistant.

---

## 💡 The Problem We Solve

Different AI assistants (Cursor, Windsurf, Claude Code, Antigravity, custom agents) generate static artifacts (landing pages, interactive components, data dashboards, UI mockups) differently:
- Some lock previews to proprietary hosted domains.
- Others dump files to local disk with no easy way to preview or share them.
- Developers lack a unified, self-hostable destination to deploy artifacts regardless of which agent produced them.

**Our role**: Provide a unified, open Model Context Protocol (MCP) server and lightweight hosting backend that any agent can call to deploy, preview, and manage static artifacts instantly.

---

## 🧭 Core Design Principles for Agents

When implementing features or refactoring code in this repository:

1. **Agent-First Developer Experience (DX)**:
   - Tool inputs must have sensible defaults with clear error messages.
   - Return clean, structured markdown responses containing actionable URLs and status summaries.
   - Never require interactive terminal prompts during tool executions.
2. **Zero Overhead & Ephemeral Lifecycles**:
   - Prefer in-memory operations (e.g., zip streams) over lingering disk writes.
   - Support ephemeral project lifetimes (TTL/expiration) and clean teardown methods.
3. **Monorepo Separation of Concerns**:
   - `apps/web`: Handles storage abstractions, REST APIs, and the human-facing UI.
   - `packages/mcp-server`: Standalone MCP client library for standard JSON-RPC tools (`stdio` / `SSE`).
   - Any new agent capability should expose both an API endpoint in `apps/web` and a corresponding tool in `packages/mcp-server`.
4. **Security & Sanitization**:
   - Always sanitize uploaded file paths to prevent directory traversal (`../`).
   - Validate auth tokens using secure hashing.
   - Enforce payload size limits based on authentication status.
5. **Self-Hostable & Modular**:
   - Keep backend integrations modular (especially in `apps/web/lib/storage.ts`) so alternative storage providers (S3, R2, MinIO, Local Disk) can be slotted in cleanly.

---

## 🧱 Repository Architecture & Key Paths

```
static-website-uploader/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── api/
│       │   │   ├── upload/route.ts      # Main zip/file upload ingestion
│       │   │   ├── projects/route.ts    # Project retrieval & deletion
│       │   │   ├── user/projects/       # Authenticated user site listings
│       │   │   └── admin/               # Admin management endpoints
│       │   ├── [projectId]/             # Dynamic route serving uploaded static assets
│       │   └── page.tsx                 # Web drag-and-drop UI
│       └── lib/
│           ├── storage.ts               # Storage layer abstractions (Vercel Blob)
│           └── auth.ts                  # Auth token & session verification
└── packages/
    └── mcp-server/
        └── src/
            └── index.ts                 # MCP Server tool definitions (publish_site, list_sites)
```

---

## 🛠️ Common Tasks & Workflows

### 1. Adding a New MCP Tool
1. Define the REST endpoint in `apps/web/app/api/...`.
2. Define the tool schema and handler in `packages/mcp-server/src/index.ts`.
3. Add input argument validation functions.
4. Update `packages/mcp-server/README.md` and `FEATURES.md`.
5. Run `pnpm build:mcp` to ensure compilation succeeds.

### 2. Modifying Storage Logic
- Keep storage operations decoupled in `apps/web/lib/storage.ts` to facilitate multi-storage adapter support.

### 3. Verification & Testing
Before finishing any task:
```bash
# Build web app
pnpm build:web

# Build MCP server package
pnpm build:mcp
```

---

## 📚 Key Reference Documents

- [FEATURES.md](FEATURES.md) — Inventory of current capabilities.
- [ROADMAP.md](ROADMAP.md) — Strategic feature milestones and vision.
- [SETUP.md](SETUP.md) — Local development and environment setup.
- [packages/mcp-server/README.md](packages/mcp-server/README.md) — MCP server configuration details.
