import * as vscode from 'vscode';
import { KimiClient } from '../api/kimi';
import { ChatMessage } from '../api/types';
import { SYSTEM_PROMPT, ERROR_MESSAGES, randomFrom } from '../branding/messages';

export class InlineChatProvider {
  private _client: KimiClient;

  constructor() {
    this._client = new KimiClient();
  }

  async showInlineChat() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage(
        'Kursor: Open a file first! Even Cursor needs that.'
      );
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    const language = editor.document.languageId;
    const fileName = editor.document.fileName;

    // Show input box (模仿 Cursor 的 Cmd+K 弹出框)
    const prompt = await vscode.window.showInputBox({
      title: '⌨️ Kursor Inline Chat',
      prompt: selectedText
        ? 'What should I do with the selected code? (Free of charge)'
        : 'What code should I generate here? (No subscription needed)',
      placeHolder: 'e.g., "refactor this", "add error handling", "explain this"...',
      ignoreFocusOut: true,
    });

    if (!prompt) { return; }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nYou are performing an inline code edit. Respond ONLY with the replacement code, no explanations. Do not wrap in markdown code blocks unless the user asks for it.' },
    ];

    if (selectedText) {
      messages.push({
        role: 'user',
        content: `File: ${fileName} (${language})\n\nSelected code:\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\nInstruction: ${prompt}`,
      });
    } else {
      // Get surrounding context
      const line = editor.selection.active.line;
      const startLine = Math.max(0, line - 10);
      const endLine = Math.min(editor.document.lineCount - 1, line + 10);
      const context = editor.document.getText(
        new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length)
      );

      messages.push({
        role: 'user',
        content: `File: ${fileName} (${language})\nCursor is at line ${line + 1}.\n\nSurrounding code:\n\`\`\`${language}\n${context}\n\`\`\`\n\nInstruction: ${prompt}\n\nGenerate only the code to insert at the cursor position.`,
      });
    }

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '⌨️ Kursor is cooking... (for free)',
        cancellable: true,
      },
      async (progress, token) => {
        try {
          const abortController = new AbortController();
          token.onCancellationRequested(() => abortController.abort());

          let result = '';
          for await (const chunk of this._client.chatStream(messages, abortController.signal)) {
            result += chunk;
            progress.report({ message: `${result.length} chars generated...` });
          }

          // Remove markdown fences, then normalize insertion based on editor context.
          const cleaned = this._stripMarkdownFences(result);
          const nextText = selectedText
            ? cleaned.trim()
            : this._formatInsertion(cleaned, editor, editor.selection.active);

          // Apply edit
          await editor.edit((editBuilder) => {
            if (selectedText) {
              editBuilder.replace(selection, nextText);
            } else {
              editBuilder.insert(editor.selection.active, nextText);
            }
          });

          vscode.window.showInformationMessage(
            '⌨️ Kursor: Done! That would have cost you $0.02 on Cursor.'
          );
        } catch (error: any) {
          if (error.message === 'Request aborted') { return; }
          vscode.window.showErrorMessage(
            `⌨️ Kursor Error: ${error.message || randomFrom(ERROR_MESSAGES)}`
          );
        }
      }
    );
  }

  private _stripMarkdownFences(text: string): string {
    return text
      .replace(/^```[\w-]*\r?\n?/, '')
      .replace(/\r?\n?```$/, '')
      .replace(/\r\n/g, '\n');
  }

  private _formatInsertion(
    text: string,
    editor: vscode.TextEditor,
    position: vscode.Position
  ): string {
    const normalized = text.trim();
    if (!normalized) { return ''; }

    const line = editor.document.lineAt(position.line).text;
    const before = line.slice(0, position.character);
    const after = line.slice(position.character);

    let insertText = normalized;
    if (before.trim().length > 0 && !insertText.startsWith('\n')) {
      insertText = `\n${insertText}`;
    }
    if (after.trim().length > 0 && !insertText.endsWith('\n')) {
      insertText = `${insertText}\n`;
    }

    return insertText;
  }
}
