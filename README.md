# ⌨️ Kursor

> The AI Code Editor that Cursor wishes it was.

## What is this?

**Kursor** is a VSCode extension that gives you the full Cursor AI experience — powered by **Kimi (Moonshot AI)** — for absolutely free.

Why pay $20/month for Cursor when you can have **Kursor Pro Max Ultra™**?

## Kursor vs Cursor — An Honest Comparison

| Feature | Kursor | Cursor |
|---------|--------|--------|
| Price | **Free** | $20/month |
| AI Model | Kimi (your choice) | Whatever they decide |
| Open Source | **Yes** | Lol no |
| Subscription | **Never** | Always |
| Respects Your Wallet | ✅ | ❌ |
| Name Coolness | K > C | - |
| Made with | Love | VC money |

## Features

- 🗨️ **AI Chat Sidebar** — Cursor-style chat panel, but free
- ⌨️ **Inline Chat (Ctrl/Cmd+Shift+K)** — Edit code inline with AI, just like Cursor
- 📝 **Code Context** — Automatically reads your current file and selection
- 🌙 **Kimi API** — Powered by Moonshot AI, OpenAI-compatible
- 🎭 **Tasteful Satire** — Every interaction reminds you how much money you're saving

## Quick Start

1. Install the extension
2. Run `Kursor: Set Kimi API Key` from command palette
3. Get your free API key at [platform.moonshot.ai](https://platform.moonshot.ai/)
4. Start chatting in the Kursor sidebar
5. Use `Ctrl+Shift+K` / `Cmd+Shift+K` for inline code editing

## Supported Models

- `moonshot-v1-8k` — Quick and nimble
- `moonshot-v1-32k` — Balanced (default)
- `moonshot-v1-128k` — Big brain energy
- `kimi-k2.5` — The latest and greatest

## Development

```bash
cd kursor
npm install
npm run compile
# Press F5 in VSCode to launch Extension Development Host
```

Packaging the extension currently requires `Node 20.18.1+` because of the `vsce` toolchain.

## Testing

- Compile check: `npm run compile`
- Packaging gate: `npm run verify-node`
- Manual regression evidence: `docs/manual-regression/2026-03-22.md`

## Disclaimer

This project is a satirical, educational project. Cursor is a great product (we just think Kimi deserves some love too). No Cursor engineers were harmed in the making of this extension.

## License

MIT — Because unlike some editors, we believe in freedom.

---

*Kursor Pro Max Ultra™ — Saving developers $240/year since 2026.*
