# Changelog

## [0.0.2] - 2026-03-22

### Added
- **Agent Mode** — Kimi can now search your codebase, read files, run terminal commands, and edit files
  - `searchWorkspace` — Glob + text search across workspace (auto-execute)
  - `readFile` — Read any file in workspace (auto-execute)
  - `runCommand` — Execute shell commands (requires user approval)
  - `editFile` — Create/modify files (requires user approval)
- Agent loop with max 20 iterations and streaming output
- Tool call UI: collapsible cards with status indicators and Accept/Reject buttons
- Mode selector: toggle between **Agent** and **Ask** modes
- Code blocks with **Copy** and **Insert** buttons
- Basic syntax highlighting for JS/TS/Python/Java/Go/Rust
- **Stop generating** button during streaming
- `@` mention autocomplete (@file, @selection, @currentFile, @errors)
- Enhanced Markdown rendering (headers, lists, blockquotes, links)
- Webview state persistence (chat survives tab switches)
- `retainContextWhenHidden` for stable sidebar experience
- New settings: `agentMaxIterations`, `commandTimeout`

### Security
- Path traversal prevention in file operations
- Dangerous tools require explicit user approval
- 60-second approval timeout (auto-reject)
- Output truncation for large results

## [0.0.1] - 2026-03-22

### Added
- Initial release
- Cursor-style chat sidebar with Kimi API integration
- Inline Chat via `Cmd+Shift+K` / `Ctrl+Shift+K`
- Streaming responses (OpenAI-compatible)
- Auto code context (current file / selection)
- Model selector (moonshot-v1-8k/32k/128k, kimi-k2.5)
- Status bar with rotating satirical messages
- Welcome notification with API key setup prompt
