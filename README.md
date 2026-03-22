# ⌨️ Kursor

> The AI Code Editor that Cursor wishes it was.

**Kursor** is a free, open-source VSCode extension that brings the full Cursor AI experience — powered by **Kimi (Moonshot AI)**.

Why pay $20/month when you can have **Kursor Pro Max Ultra™**?

## Kursor vs Cursor

| Feature | Kursor | Cursor |
|---------|--------|--------|
| Price | **Free** | $20/month |
| AI Model | Kimi (your choice) | Whatever they decide |
| Open Source | **Yes** | No |
| Agent Mode | ✅ | ✅ |
| Code Search | ✅ | ✅ |
| File Edit | ✅ | ✅ |
| Terminal | ✅ | ✅ |
| Name Coolness | K > C | — |

## Features

### 🤖 Agent Mode
Kimi can autonomously search your codebase, read files, run commands, and edit code — just like Cursor Agent.

- **searchWorkspace** — Find files by glob pattern or search contents by text
- **readFile** — Read any file in your workspace
- **runCommand** — Execute shell commands (with your approval)
- **editFile** — Create or modify files (with your approval)

Tool calls are displayed as collapsible cards with Accept/Reject buttons for dangerous operations.

### 💬 AI Chat Sidebar
Cursor-style chat panel with streaming responses, Markdown rendering, and syntax-highlighted code blocks.

### ⌨️ Inline Chat
Press `Cmd+Shift+K` (Mac) or `Ctrl+Shift+K` (Windows/Linux) to edit code inline with AI.

### 📝 Smart Context
Automatically includes your current file and selection as context. Use `@file`, `@selection`, `@currentFile` to reference specific context.

### 🔧 Code Block Actions
Every code block in chat has **Copy** and **Insert** buttons to quickly use generated code.

## Quick Start

1. Install the extension
2. Run **Kursor: Set Kimi API Key** from the command palette (`Cmd+Shift+P`)
3. Get your free API key at [platform.moonshot.ai](https://platform.moonshot.ai/)
4. Start chatting in the Kursor sidebar
5. Toggle between **Agent** and **Ask** modes in the toolbar

## Supported Models

| Model | Context | Use Case |
|-------|---------|----------|
| `moonshot-v1-8k` | 8K | Quick questions |
| `moonshot-v1-32k` | 32K | General coding (default) |
| `moonshot-v1-128k` | 128K | Large file analysis |
| `kimi-k2.5` | 256K | Latest model, best for Agent mode |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `kursor.apiKey` | — | Your Kimi API key |
| `kursor.model` | `moonshot-v1-32k` | AI model to use |
| `kursor.apiBase` | `https://api.moonshot.ai/v1` | API endpoint |
| `kursor.temperature` | `0.7` | Response creativity (0–1) |
| `kursor.agentMaxIterations` | `20` | Max tool call rounds per turn |
| `kursor.commandTimeout` | `30000` | Shell command timeout (ms) |

## Development

```bash
git clone https://github.com/teee32/kursor.git
cd kursor
npm install
npm run compile
# Press F5 in VSCode to launch Extension Development Host
```

> **Note:** Packaging requires Node 20.18.1+ (`npm run package`).

## Project Structure

```
kursor/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── api/
│   │   ├── kimi.ts           # Kimi API client (streaming + tool calling)
│   │   └── types.ts          # TypeScript interfaces
│   ├── chat/
│   │   ├── ChatProvider.ts   # Webview provider (Agent/Ask orchestration)
│   │   └── chat.html         # Chat UI (Cursor-style)
│   ├── inline/
│   │   └── InlineProvider.ts # Inline chat (Cmd+Shift+K)
│   ├── agent/
│   │   ├── tools.ts          # Tool definitions (OpenAI function calling format)
│   │   ├── toolExecutor.ts   # Tool execution (search, read, run, edit)
│   │   ├── agentLoop.ts      # Agent conversation loop
│   │   └── agentPrompt.ts    # Agent system prompt
│   └── branding/
│       └── messages.ts       # UI text and satirical messages
├── media/
│   └── icon.svg              # Extension icon
├── package.json
├── tsconfig.json
├── LICENSE
└── CHANGELOG.md
```

## Disclaimer

This is a satirical, educational project. Cursor is a great product — we just think Kimi deserves some love too. No Cursor engineers were harmed in the making of this extension.

## License

[MIT](LICENSE) — Because unlike some editors, we believe in freedom.

---

*Kursor Pro Max Ultra™ — Saving developers $240/year since 2026.*
