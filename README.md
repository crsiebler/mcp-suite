# MCP Suite

A comprehensive monorepo suite of MCP (Model Context Protocol) servers built for standardized development and deployment.

## Development and AI guidance

[AGENTS.md](AGENTS.md) contains harness-neutral repository instructions.
Start with the [repository map](docs/overview.md) for architecture, extension
points, and verification guidance. All AI harnesses use the same instructions.

## 🏗️ Architecture

```
mcp-suite/
├── docs/               # Documentation and setup guides
├── shared/             # Shared utilities and types
│   ├── types/          # Common TypeScript interfaces
│   ├── utils/          # Utility functions (logger, config, validation)
│   └── middleware/     # Unused authentication helper, retained unchanged
├── servers/            # Individual MCP servers
│   ├── aijobsearch/   # ASU skills extraction and job matching
│   ├── flight/        # Duffel flight search and booking
│   ├── canvas/        # Canvas LMS server for educational workflows
│   ├── postgresql/    # PostgreSQL database management server
│   ├── salesforce/    # Salesforce CRM server with OAuth authentication
│   ├── clickup/       # ClickUp server for task and project management
│   └── elasticsearch/ # Elasticsearch server for search and analytics
├── scripts/           # Build and deployment scripts
├── config/            # Generated server inventory; not runtime settings
└── tests/             # Test suite (unit, integration, fixtures)
```

## 🚀 Quick Start

Requires Node.js 22.14.0 or newer. The locked workspace dependency graph is
verified against this minimum.

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/crsiebler/mcp-suite.git
   cd mcp-suite
   npm ci
   ```

2. **Build all servers:**

   ```bash
   npm run build -- --server=all
   ```

## 📖 Setup Documentation

For retained client-specific setup examples, see the guide below. Verify package
availability and compiled paths before use; engineering guidance lives in the
[repository map](docs/overview.md).

📋 **[MCP Setup Guide](docs/MCP_SETUP_GUIDE.md)**

## Package ownership

This checkout is maintained at [crsiebler/mcp-suite](https://github.com/crsiebler/mcp-suite).
Server manifests and examples use the `@crsiebler` npm scope. Renaming source
metadata does not publish or transfer npm packages; registry-based examples
require the corresponding package to be published first. Until then, use the
[local build workflow](docs/server-development.md). Package author metadata identifies Cory <cory.siebler@phitechsolutions.com>.
Original implementation credit remains with Azharuddin; existing license
declarations and historical release records are retained.

## Available servers

The [generated server catalog](docs/server-catalog.md) lists all seven npm
workspaces, exact tool names/counts, compiled entry points and credential settings:
AI Job Search, Canvas, ClickUp, Elasticsearch, Flight (Duffel), PostgreSQL and
Salesforce. Its source is workspace manifest metadata plus actual built tool exports.
Run `npm run catalog:check` to detect stale inventory; it builds current source first.

AI Job Search remains experimental: its provider routes/taxonomy are unverified.
Resolve its [live-readiness blocker](servers/aijobsearch/README.md#provider-readiness-unresolved)
before sending private content. Canvas defaults to all tools and supports optional
[category selection](docs/canvas-tools.md). Provider account permissions still apply.

For Jira Cloud, use the [official Atlassian Rovo MCP](docs/atlassian-rovo.md).
The ten removed vendor-overlapping servers are not local packages.

## Development

- [Server development](docs/server-development.md): extension points, build commands,
  generated outputs, and release boundaries.
- [Architecture](docs/architecture.md): request flow, shared helpers, and configuration.
- [Testing](docs/testing.md): command selection, prerequisites, and coverage limits.

Build one server with `npm run build -- --server=postgresql`, or all servers with
`npm run build -- --server=all`. Without arguments, the build is non-interactive
and builds all seven npm workspaces. The private root and single root lockfile own
installation; use `npm ci`. `npm pack --workspace=<package-name>` runs the package
prepack build. See the server-development guide for artifact checks and paths.
Building does not start a server.

## Runtime diagnostics

Logging and error behavior vary by server. See [architecture](docs/architecture.md)
for shared logger behavior and inspect the selected server's entry point for its
actual diagnostics. This map does not establish shared health endpoints or metrics.

## Contributing

Read [AGENTS.md](AGENTS.md), make scoped changes on a feature branch, and run the
relevant checks from [testing](docs/testing.md). Use
`<type>(<scope>): <description>` for authorized commits. Preserve upstream
attribution and review package identity separately from code changes.

## 📝 License

Existing manifests declare MIT. No original license text/copyright notice has
been recovered; see [license provenance](docs/licensing.md). Metadata ownership
changes do not establish copyright ownership or relicense upstream code.

## 🆘 Support

- Create an issue for bug reports or feature requests
- Check existing documentation in individual server README files
- Review the shared utilities documentation for development guidance
