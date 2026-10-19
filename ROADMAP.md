# 🗺️ Product Roadmap

This document outlines the strategic roadmap to establish **Airtifact** as the premier open-source, zero-config deployment layer and universal artifact hub for AI coding agents.

---

## 🎯 Vision

> **The universal, open-source artifact publishing layer for AI coding assistants.**  
> Give any AI agent (Claude Code, Cursor, Windsurf, Antigravity, custom agentic frameworks) the ability to turn code artifacts into live, shareable previews in a single tool call—without vendor lock-in.

---

## 📍 Phase 1: Core Agent Experience & Primitives *(In Progress / Immediate)*

Focus: Streamlining agent interactions and eliminating friction during autonomous tool use.

- [x] **Model Context Protocol (MCP) Server**: Official `@airtifact/mcp` package supporting stdio transport.
- [x] **`publish_site` & `list_sites` MCP Tools**: Directory packing and publishing directly from local agent workspaces.
- [ ] **Single File / In-Memory Deployments (`publish_html` & `publish_files`)** ([#18](https://github.com/yhauxell/airtifact/issues/18)):
  - Allow agents to publish single HTML files or in-memory file trees directly without needing to create directory/ZIP structures on disk.
- [ ] **Ephemeral Previews & Configurable TTL** ([#19](https://github.com/yhauxell/airtifact/issues/19)):
  - Auto-expiration options (e.g., `expireIn: "1h" | "24h" | "7d" | "never"`).
  - Automated cleanup to reduce storage clutter from rapid agent explorations and scratchpad mockups.
- [ ] **Site Revision & Updates (`update_site`)** ([#20](https://github.com/yhauxell/airtifact/issues/20)):
  - Enable agents to update an existing `projectId` over iterative prompting loops rather than generating new URLs every turn.
- [x] **Native Markdown Engine & Document Rendering (`publish_markdown` & `.md` pages)** ([#21](https://github.com/yhauxell/airtifact/issues/21)):
  - **Zero-Build Markdown Publishing**: Upload single `.md` files or folders of Markdown documents without requiring manual HTML/static site generation builds.
  - **Next.js Server-Side Markdown Pipeline**: Beautifully renders GitHub Flavored Markdown (GFM), syntax-highlighted code blocks, LaTeX/math expressions (`KaTeX`), and Mermaid diagrams directly into styled HTML pages.
  - **Multi-Document Docset / Knowledge-Base Mode**: Automatic table-of-contents, navigation sidebar, and nested route resolution for multi-file Markdown documentation projects.
- [ ] **Agent-Aware Content Negotiation (`/` & `llms.txt`)** ([#22](https://github.com/yhauxell/airtifact/issues/22)):
  - **Human User-Agent**: Serves the visual drag-and-drop web UI with real-time preview iframes.
  - **AI Agent / CLI User-Agent** (or `Accept: text/markdown` / `application/json`): Automatically serves a token-efficient, concise markdown spec containing MCP installation commands (`@airtifact/mcp`), API integration snippets (cURL/Node/Python), and endpoint schemas—bypassing unnecessary HTML/CSS/JS rendering.
  - **Standardized `/.well-known/llms.txt` & `llms-full.txt`**: Native discovery routes for LLMs and crawler agents.

---

## 📍 Phase 2: Autonomous Agent Feedback & Verification Loop

Focus: Enabling agents to "see" and verify their deployments before presenting them to users.

- [ ] **Automated Headless Preview / Screenshot Generation** ([#23](https://github.com/yhauxell/airtifact/issues/23)):
  - Capture rendered page screenshots upon deployment and return preview image metadata in the tool response.
- [ ] **Basic Health & Console Check** ([#24](https://github.com/yhauxell/airtifact/issues/24)):
  - Detect runtime JavaScript errors or missing assets (`404`s) during deployment and return actionable error logs directly into the agent's context.
- [ ] **Custom Slug, Project Aliasing & Wildcard Subdomains (`*.airtifact.page`)** ([#25](https://github.com/yhauxell/airtifact/issues/25)):
  - **Zero-Config Wildcard Subdomain Routing**: Automatically map project IDs and custom aliases to direct subdomains (e.g., `https://<alias>.airtifact.page` or `https://<projectId>.airtifact.page`) via Next.js Middleware edge routing and wildcard DNS without requiring API calls.
  - **Programmatic Custom 3rd-Party Domains**: Allow agents and developers to attach custom external domains (e.g. `preview.mycompany.com`) via programmatic Vercel Domains API integration with automatic SSL provisioning.

---

## 📍 Phase 3: Developer Ecosystem & Protocol Expansion

Focus: Expanding compatibility across developer ecosystems and agent runtimes.

- [ ] **Remote MCP (HTTP / Server-Sent Events / Streamable Transport)** ([#26](https://github.com/yhauxell/airtifact/issues/26)):
  - Provide a hosted/remote MCP endpoint option so users and agents can connect without requiring local Node runtime setup.
- [ ] **Official CLI Tool (`@airtifact/cli`)** ([#27](https://github.com/yhauxell/airtifact/issues/27)):
  - Fast standalone command-line tool for terminal-based workflows (e.g., `airtifact deploy ./dist --ttl 24h`).
- [ ] **Framework Toolkits (LangChain, LlamaIndex, CrewAI)** ([#28](https://github.com/yhauxell/airtifact/issues/28)):
  - Pre-built tool integrations for popular Python and TypeScript agent orchestration frameworks.
- [ ] **Registry Listings** ([#29](https://github.com/yhauxell/airtifact/issues/29)):
  - Submit and verify the MCP server on Smithery, PulseMCP, and MCP directories.

---

## 📍 Phase 4: Multi-Storage Backends & Self-Hosting

Focus: Storage flexibility, vendor independence, and frictionless self-hosting.

- [ ] **Pluggable Storage Provider Architecture (`StorageAdapter` interface)** ([#17](https://github.com/yhauxell/airtifact/issues/17)):
  - Abstract the storage engine so developers can configure any backend via environment variables.
- [ ] **First-Class Storage Provider Adapters**:
  - **AWS S3 / S3-Compatible Storage** ([#17](https://github.com/yhauxell/airtifact/issues/17)): Native AWS S3 support with custom endpoints, bucket policies, and region selection.
  - **Cloudflare R2, MinIO & Supabase Storage** ([#31](https://github.com/yhauxell/airtifact/issues/31)): High-performance zero-egress or self-hosted S3-compatible object storage integrations.
  - **Local Filesystem Storage** ([#30](https://github.com/yhauxell/airtifact/issues/30)): Zero external cloud dependency mode for purely local or offline agent environments.
- [ ] **1-Click Self-Host Deployments** ([#32](https://github.com/yhauxell/airtifact/issues/32)):
  - Standalone Docker Compose, Railway, and Render deployment templates with built-in storage switching.
- [ ] **Site Access Protection** ([#33](https://github.com/yhauxell/airtifact/issues/33)):
  - Optional password protection or token-gated access for published preview URLs.

---

## 💬 Feedback & Suggestions

Have ideas or requests for the roadmap? Feel free to open an issue or submit a pull request on GitHub!
