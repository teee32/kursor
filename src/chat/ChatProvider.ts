import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { KimiClient } from '../api/kimi';
import { ChatMessage, ToolResult } from '../api/types';
import {
  ERROR_MESSAGES,
  SYSTEM_PROMPT,
  randomFrom,
} from '../branding/messages';
import { AGENT_SYSTEM_PROMPT } from '../agent/agentPrompt';
import { AgentLoop } from '../agent/agentLoop';
import { ToolExecutor } from '../agent/toolExecutor';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'kursor.chatView';
  private static readonly MODEL_LABELS: Record<string, string> = {
    'kimi-k2.5': 'Kimi K2.5 Fast',
    'moonshot-v1-128k': 'Moonshot 128K',
    'moonshot-v1-32k': 'Moonshot 32K',
    'moonshot-v1-8k': 'Moonshot 8K',
  };
  private _view?: vscode.WebviewView;
  private _messages: ChatMessage[] = [];
  private _client: KimiClient;
  private _abortController?: AbortController;
  private _mode: 'ask' | 'agent' = 'agent';
  private _pendingApproval?: {
    toolCallId: string;
    resolve: (approved: boolean) => void;
  };

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._client = new KimiClient();
    this._resetChat();
  }

  public clearChat() {
    this._cancelActiveRequest();
    this._resetChat();
    this._view?.webview.postMessage({ type: 'chatReset' });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'chat':
          await this._handleChat(msg.content);
          break;
        case 'clear':
          this.clearChat();
          break;
        case 'stop':
          this._cancelActiveRequest();
          break;
        case 'setMode':
          this._mode = msg.mode;
          this.clearChat();
          break;
        case 'setModel':
          await vscode.workspace
            .getConfiguration('kursor')
            .update('model', msg.model, vscode.ConfigurationTarget.Global);
          break;
        case 'insertCode':
          this._insertCodeToEditor(msg.content);
          break;
        case 'toolApproval':
          if (this._pendingApproval && this._pendingApproval.toolCallId === msg.toolCallId) {
            this._pendingApproval.resolve(msg.approved);
            this._pendingApproval = undefined;
          }
          break;
      }
    });
  }

  private _resetChat() {
    const prompt = this._mode === 'agent' ? AGENT_SYSTEM_PROMPT : SYSTEM_PROMPT;
    this._messages = [{ role: 'system', content: prompt }];
  }

  private _cancelActiveRequest() {
    this._abortController?.abort();
    this._abortController = undefined;

    if (this._pendingApproval) {
      this._pendingApproval.resolve(false);
      this._pendingApproval = undefined;
    }
  }

  private _insertCodeToEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Kursor: No active editor to insert code into.');
      return;
    }
    editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, code);
      } else {
        editBuilder.replace(editor.selection, code);
      }
    });
  }

  private async _handleChat(userMessage: string) {
    if (!this._view) { return; }

    // Get editor context
    const editor = vscode.window.activeTextEditor;
    let contextInfo = '';
    if (editor) {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const fileName = path.basename(editor.document.fileName);
      const language = editor.document.languageId;

      if (selectedText) {
        contextInfo = `\n\n[Context: User has selected the following code from ${fileName} (${language})]\n\`\`\`${language}\n${selectedText}\n\`\`\``;
      } else {
        const fullText = editor.document.getText();
        const preview = fullText.split('\n').slice(0, 100).join('\n');
        contextInfo = `\n\n[Context: User is viewing ${fileName} (${language})]\n\`\`\`${language}\n${preview}\n\`\`\``;
      }
    }

    this._messages.push({
      role: 'user',
      content: userMessage + contextInfo,
    });

    let abortController: AbortController | undefined;
    try {
      abortController = new AbortController();
      this._abortController = abortController;
      this._view.webview.postMessage({ type: 'streamStart' });

      if (this._mode === 'agent') {
        await this._handleAgentChat();
      } else {
        await this._handleSimpleChat();
      }
    } catch (error: any) {
      if (error.message === 'Request aborted') {
        this._view.webview.postMessage({ type: 'streamEnd' });
        return;
      }
      const errMsg = error.message || randomFrom(ERROR_MESSAGES);
      this._view.webview.postMessage({
        type: 'error',
        content: errMsg,
      });
    } finally {
      this._pendingApproval = undefined;
      if (this._abortController === abortController) {
        this._abortController = undefined;
      }
    }
  }

  private async _handleSimpleChat() {
    if (!this._view) { return; }

    let fullResponse = '';
    for await (const chunk of this._client.chatStream(
      this._messages,
      this._abortController?.signal
    )) {
      fullResponse += chunk;
      this._view.webview.postMessage({
        type: 'streamChunk',
        content: chunk,
      });
    }

    this._messages.push({ role: 'assistant', content: fullResponse });
    this._view.webview.postMessage({ type: 'streamEnd' });
  }

  private async _handleAgentChat() {
    if (!this._view) { return; }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._view.webview.postMessage({
        type: 'error',
        content: 'Agent mode requires an open workspace folder. Open a folder first!',
      });
      return;
    }

    const config = vscode.workspace.getConfiguration('kursor');
    const maxIterations = config.get<number>('agentMaxIterations', 20);
    const commandTimeout = config.get<number>('commandTimeout', 30000);

    const toolExecutor = new ToolExecutor(
      workspaceFolder.uri.fsPath,
      commandTimeout
    );
    const agentLoop = new AgentLoop(
      this._client,
      toolExecutor,
      {
        onTextChunk: (text) => {
          this._view!.webview.postMessage({
            type: 'streamChunk',
            content: text,
          });
        },
        onToolCallStart: (toolName, args, toolCallId) => {
          this._view!.webview.postMessage({
            type: 'toolCallStart',
            toolName,
            args,
            toolCallId,
          });
        },
        onToolCallComplete: (toolCallId, result) => {
          this._view!.webview.postMessage({
            type: 'toolCallComplete',
            toolCallId,
            result,
          });
        },
        onApprovalRequired: (toolName, args, toolCallId) => {
          return new Promise<boolean>((resolve) => {
            this._pendingApproval = { toolCallId, resolve };
            this._view!.webview.postMessage({
              type: 'toolApprovalRequest',
              toolName,
              args,
              toolCallId,
            });
          });
        },
        onComplete: () => {
          this._view!.webview.postMessage({ type: 'streamEnd' });
        },
        onError: (error) => {
          this._view!.webview.postMessage({
            type: 'error',
            content: error.message,
          });
        },
      },
      maxIterations
    );

    this._messages = await agentLoop.run(
      this._messages,
      this._abortController?.signal
    );
  }

  private _getHtml(): string {
    let htmlPath = path.join(this._extensionUri.fsPath, 'out', 'chat', 'chat.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(this._extensionUri.fsPath, 'src', 'chat', 'chat.html');
    }
    const config = vscode.workspace.getConfiguration('kursor');
    const model = config.get<string>('model', 'moonshot-v1-32k');
    const initialState = {
      mode: this._mode,
      model,
      modelLabel: ChatViewProvider.MODEL_LABELS[model] || model,
    };

    return fs
      .readFileSync(htmlPath, 'utf8')
      .replace('__KURSOR_INITIAL_STATE__', JSON.stringify(initialState));
  }
}
