# 🗺️ Product Roadmap

This document outlines the strategic roadmap to establish **static-website-uploader** as the premier open-source, zero-config deployment layer and universal artifact hub for AI coding agents.

---

## 🎯 Vision

> **The universal, open-source artifact publishing layer for AI coding assistants.**  
> Give any AI agent (Claude Code, Cursor, Windsurf, Antigravity, custom agentic frameworks) the ability to turn code artifacts into live, shareable previews in a single tool call—without vendor lock-in.

---

## 📍 Phase 1: Core Agent Experience & Primitives *(In Progress / Immediate)*

Focus: Streamlining agent interactions and eliminating friction during autonomous tool use.

- [x] **Model Context Protocol (MCP) Server**: Official `@yhauxell/static-site-mcp-server` package supporting stdio transport.
- [x] **`publish_site` & `list_sites` MCP Tools**: Directory packing and publishing directly from local agent workspaces.
- [ ] **Single File / In-Memory Deployments (`publish_html` & `publish_files`)**:
  - Allow agents to publish single HTML files or in-memory file trees directly without needing to create directory/ZIP structures on disk.
- [ ] **Ephemeral Previews & Configurable TTL**:
  - Auto-expiration options (e.g., `expireIn: "1h" | "24h" | "7d" | "never"`).
  - Automated cleanup to reduce storage clutter from rapid agent explorations and scratchpad mockups.
- [ ] **Site Revision & Updates (`update_site`)**:
  - Enable agents to update an existing `projectId` over iterative prompting loops rather than generating new URLs every turn.

---

## 📍 Phase 2: Autonomous Agent Feedback & Verification Loop

Focus: Enabling agents to "see" and verify their deployments before presenting them to users.

- [ ] **Automated Headless Preview / Screenshot Generation**:
  - Capture rendered page screenshots upon deployment and return preview image metadata in the tool response.
- [ ] **Basic Health & Console Check**:
  - Detect runtime JavaScript errors or missing assets (`404`s) during deployment and return actionable error logs directly into the agent's context.
- [ ] **Custom Slug & Project Aliasing (`alias`)**:
  - Allow agents to assign readable preview aliases (e.g., `preview-landing-v2`).

---

## 📍 Phase 3: Developer Ecosystem & Protocol Expansion

Focus: Expanding compatibility across developer ecosystems and agent runtimes.

- [ ] **Remote MCP (HTTP / Server-Sent Events / Streamable Transport)**:
  - Provide a hosted/remote MCP endpoint option so users and agents can connect without requiring local Node runtime setup.
- [ ] **Official CLI Tool (`@yhauxell/static-uploader-cli`)**:
  - Fast standalone command-line tool for terminal-based workflows (e.g., `static-deploy ./dist --ttl 24h`).
- [ ] **Framework Toolkits (LangChain, LlamaIndex, CrewAI)**:
  - Pre-built tool integrations for popular Python and TypeScript agent orchestration frameworks.
- [ ] **Registry Listings**:
  - Submit and verify the MCP server on Smithery, PulseMCP, and MCP directories.

---

## 📍 Phase 4: Self-Hosting & Storage Modularity

Focus: Flexibility, portability, and easy self-hosting.

- [ ] **Multi-Storage Backend Adapters**:
  - Modular storage interface supporting AWS S3, Cloudflare R2, MinIO, and local disk alongside Vercel Blob.
- [ ] **1-Click Self-Host Deployments**:
  - Standalone Docker Compose, Railway, and Render deployment templates.
- [ ] **Site Access Protection**:
  - Optional password protection or token-gated access for published preview URLs.

---

## 💬 Feedback & Suggestions

Have ideas or requests for the roadmap? Feel free to open an issue or submit a pull request on GitHub!
