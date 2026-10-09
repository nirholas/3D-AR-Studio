# AGENTS.md

Operating notes for AI coding agents (Claude Code, Codex, Cursor, Copilot and others) working in this repository. Everything here is derived from the files actually in the tree, so trust it over guesses, and update it when the facts change.

## What this repository is

Drop a full augmented-reality studio into any web page. Place any number of 3D models in your real room through the camera, generate new ones from a text prompt, arrange them, then share the scene as a link, a QR code, or a live room. WebXR + Quick Look + Scene Viewer, a free CC0 model library, and an MCP server for agents.

- Homepage: https://nirholas.github.io/3D-AR-Studio/
- Source: https://github.com/nirholas/3D-AR-Studio
- Primary language: JavaScript
- License: Apache License 2.0 (see the LICENSE file)

## Repository layout

- `bin/`
- `docs/`
- `mcp-package/`
- `mcp/`
- `scripts/`
- `site/`
- `src/`
- `templates/`
- `test/`
- `types/`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `package.json`

Tests live in `test/`. Add or update a test next to the code you change.

## Setup

```bash
npm install
```

## Commands

| Task | Command |
|---|---|
| dev | `npm run dev` |
| build | `npm run build` |
| test | `npm test` |
| lint | `npm run lint` |

Run the test and lint commands above before you consider a change finished. If a command fails on code you did not touch, say so in your report instead of silently skipping it.

## Conventions

- `.env` files are gitignored; never commit credentials, and read configuration from environment variables.
- Commit messages follow Conventional Commits (`type(scope): summary`), matching the existing history.
- User-visible changes get an entry in `CHANGELOG.md`.
- Read the surrounding code before adding to it, and match its naming, file organisation and error-handling style.
- Keep `README.md` accurate: if a change alters behaviour, commands or configuration, update the docs in the same commit.
- Do not leave TODO comments, stub functions, placeholder data or commented-out code behind. Finish what you start or leave it out.
- Small, focused commits with a subject line that describes the change, not the act of committing.

## Where to raise things

- Bugs and feature requests: https://github.com/nirholas/3D-AR-Studio/issues
- Questions and ideas: https://github.com/nirholas/3D-AR-Studio/discussions
- Security issues: report privately at https://github.com/nirholas/3D-AR-Studio/security/advisories/new, never in a public issue.
