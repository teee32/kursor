import * as vscode from 'vscode';
import { ChatViewProvider } from './chat/ChatProvider';
import { InlineChatProvider } from './inline/InlineProvider';
import { STATUS_BAR_TEXTS, randomFrom } from './branding/messages';

export function activate(context: vscode.ExtensionContext) {
  // Register Chat sidebar
  const chatProvider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Register Inline Chat
  const inlineProvider = new InlineChatProvider();
  context.subscriptions.push(
    vscode.commands.registerCommand('kursor.inlineChat', () => {
      inlineProvider.showInlineChat();
    })
  );

  // Register Set API Key command
  context.subscriptions.push(
    vscode.commands.registerCommand('kursor.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        title: '⌨️ Kursor — Set Kimi API Key',
        prompt:
          'Enter your Kimi API key from https://platform.moonshot.ai/. It\'s free! Unlike... you know.',
        placeHolder: 'sk-...',
        password: true,
        ignoreFocusOut: true,
      });

      if (key) {
        await vscode.workspace
          .getConfiguration('kursor')
          .update('apiKey', key, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          '⌨️ Kursor: API Key saved! You just saved $240/year compared to Cursor. 🎉'
        );
      }
    })
  );

  // Register Clear Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('kursor.clearChat', () => {
      vscode.commands.executeCommand('kursor.chatView.focus');
    })
  );

  // Status bar item — 讽刺 Cursor
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = `$(keyboard) ${randomFrom(STATUS_BAR_TEXTS)}`;
  statusBar.tooltip = 'Kursor — The AI Code Editor that Cursor wishes it was';
  statusBar.command = 'kursor.chatView.focus';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Rotate status bar text every 30s
  const interval = setInterval(() => {
    statusBar.text = `$(keyboard) ${randomFrom(STATUS_BAR_TEXTS)}`;
  }, 30000);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });

  // Welcome notification on first activation
  const hasShownWelcome = context.globalState.get('kursor.welcomed');
  if (!hasShownWelcome) {
    vscode.window
      .showInformationMessage(
        '⌨️ Welcome to Kursor! The AI Code Editor that Cursor wishes it was. Set your free Kimi API key to get started.',
        'Set API Key',
        'Maybe Later'
      )
      .then((selection) => {
        if (selection === 'Set API Key') {
          vscode.commands.executeCommand('kursor.setApiKey');
        }
      });
    context.globalState.update('kursor.welcomed', true);
  }

  console.log('⌨️ Kursor activated! Cursor is shaking in its boots.');
}

export function deactivate() {
  console.log('⌨️ Kursor deactivated. But unlike Cursor, we\'ll be back... for free.');
}
