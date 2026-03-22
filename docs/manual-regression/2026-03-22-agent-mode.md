# Manual Regression Report - Agent/Tool Use - 2026-03-22

## Scope

This round validates the remote updates pulled into `main` at:

- `a18ca59` `feat: Agent mode with tool use (searchWorkspace, readFile, runCommand, editFile)`
- `39335bf` `feat: enhanced chat UI with code blocks, stop button, @ mentions, syntax highlighting`

Primary files under test:

- `src/agent/agentLoop.ts`
- `src/agent/toolExecutor.ts`
- `src/agent/tools.ts`
- `src/api/kimi.ts`
- `src/api/types.ts`
- `src/chat/ChatProvider.ts`
- `src/chat/chat.html`

## Build Under Test

- Branch: `main`
- HEAD at test time: `a18ca59`
- Compile status: `npm run compile` passed

## Environment

- VS Code `1.112.0`
- Node `v18.19.1`
- Desktop session isolated in `Xvfb :99`
- Mock Kimi API served from `http://127.0.0.1:4310/v1`
- Test workspace: `/home/ksq/agentcli/_tmp/manual-agent-workspace`

## Method

This regression used a hybrid approach:

1. Real GUI smoke in an Extension Development Host:
   - Opened the extension sidebar in VS Code and verified that the Kursor chat view renders with Agent mode enabled by default.
2. End-to-end execution of the shipped extension code from `out/`:
   - Stubbed only the `vscode` host APIs needed by the extension.
   - Drove the real compiled `KimiClient`, `AgentLoop`, `ToolExecutor`, and `ChatViewProvider` against the mock streaming API and the real filesystem.

Reason for the hybrid path:

- The `Xvfb` session rendered the webview correctly, but synthetic keyboard input did not reach the composer textarea reliably, so full prompt entry inside the webview was not stable enough to trust as evidence.
- Rather than claim a purely manual pass on a flaky desktop layer, the core agent/tool pipeline was revalidated by executing the extension's compiled code directly.

## Executed Checks

| Area | Result | Evidence |
| --- | --- | --- |
| Kursor chat view renders in Extension Development Host | Pass | `docs/manual-regression/2026-03-22/vscode-agent-chat-view.png` |
| Chat UI defaults to Agent mode with Kimi model label visible | Pass | `docs/manual-regression/2026-03-22/vscode-agent-chat-view.png` |
| `chatStreamWithTools` parses streamed tool calls for `searchWorkspace` + `readFile` | Pass | End-to-end compiled-code run against mock API |
| Agent safe-tool loop executes `searchWorkspace` then `readFile` and returns final answer | Pass | End-to-end compiled-code run against real test workspace |
| Dangerous tool approval path: `runCommand` approved | Pass | End-to-end compiled-code run returned workspace `pwd` |
| Dangerous tool approval path: `editFile` rejected | Pass | End-to-end compiled-code run kept `SHOULD_NOT_EXIST.txt` absent |
| Dangerous tool approval path: `editFile` approved | Pass | End-to-end compiled-code run created `SHOULD_NOT_EXIST.txt` with expected content and cleaned it up |
| Ask-mode streaming path still returns code-block content | Pass | End-to-end compiled-code run against mock API |

## Notes

- During testing, the first `editFile` approval attempt failed because the local mock server emitted invalid JSON for the `content` field. That was a test harness bug, not an extension bug. After fixing the mock payload to escape `\\n` correctly, the approved `editFile` path passed.
- No product defect was found in the new agent/tool-use flow from this regression round.

## Gaps

- The webview composer could not be driven reliably inside `Xvfb`, so this report does not claim a full hand-entered prompt/response cycle inside the rendered sidebar.
- UI-only behaviors introduced in `chat.html` such as `Stop generating`, `@` mention popup navigation, and inline code-block action buttons were not fully exercised end-to-end in the rendered webview because of that input limitation.
- Packaging was not rerun; local Node is still `v18.19.1`, below the previously documented packaging requirement.

## Exit Assessment

The remote update is functionally sound in the primary risk areas:

- Agent mode default wiring
- Streamed tool-call parsing
- Safe tool execution
- Dangerous tool approval and rejection
- Ask-mode streaming compatibility

Residual risk remains in the rendered webview interaction layer only, specifically around textarea input and the UI-only controls that were added in `src/chat/chat.html`.
