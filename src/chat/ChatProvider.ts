import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { KimiClient } from '../api/kimi';
import { ChatMessage } from '../api/types';
import {
  ERROR_MESSAGES,
  SYSTEM_PROMPT,
  randomFrom,
} from '../branding/messages';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'kursor.chatView';
  private _view?: vscode.WebviewView;
  private _messages: ChatMessage[] = [];
  private _client: KimiClient;
  private _abortController?: AbortController;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._client = new KimiClient();
    this._messages.push({ role: 'system', content: SYSTEM_PROMPT });
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

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'chat':
          await this._handleChat(msg.content);
          break;
        case 'clear':
          this._messages = [{ role: 'system', content: SYSTEM_PROMPT }];
          this._abortController?.abort();
          break;
        case 'setModel':
          await vscode.workspace
            .getConfiguration('kursor')
            .update('model', msg.model, vscode.ConfigurationTarget.Global);
          break;
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
        // Send first 100 lines of current file as context
        const fullText = editor.document.getText();
        const preview = fullText.split('\n').slice(0, 100).join('\n');
        contextInfo = `\n\n[Context: User is viewing ${fileName} (${language})]\n\`\`\`${language}\n${preview}\n\`\`\``;
      }
    }

    this._messages.push({
      role: 'user',
      content: userMessage + contextInfo,
    });

    try {
      this._abortController = new AbortController();
      let fullResponse = '';

      this._view.webview.postMessage({ type: 'streamStart' });

      for await (const chunk of this._client.chatStream(
        this._messages,
        this._abortController.signal
      )) {
        fullResponse += chunk;
        this._view.webview.postMessage({
          type: 'streamChunk',
          content: chunk,
        });
      }

      this._messages.push({ role: 'assistant', content: fullResponse });
      this._view.webview.postMessage({ type: 'streamEnd' });
    } catch (error: any) {
      const errMsg = error.message || randomFrom(ERROR_MESSAGES);
      this._view.webview.postMessage({
        type: 'error',
        content: errMsg,
      });
    }
  }

  private _getHtml(): string {
    // Try compiled output location first, then source (for dev)
    let htmlPath = path.join(this._extensionUri.fsPath, 'out', 'chat', 'chat.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(this._extensionUri.fsPath, 'src', 'chat', 'chat.html');
    }
    return fs.readFileSync(htmlPath, 'utf8');
  }
}
