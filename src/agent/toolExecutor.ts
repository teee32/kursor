import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ToolResult } from '../api/types';

export class ToolExecutor {
  constructor(private workspaceRoot: string) {}

  async execute(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'searchWorkspace':
          return await this.searchWorkspace(args);
        case 'readFile':
          return await this.readFile(args);
        case 'runCommand':
          return await this.runCommand(args);
        case 'editFile':
          return await this.editFile(args);
        default:
          return { success: false, output: '', error: `Unknown tool: ${toolName}` };
      }
    } catch (err: any) {
      return { success: false, output: '', error: err.message || String(err) };
    }
  }

  private resolvePath(relativePath: string): string {
    const resolved = path.resolve(this.workspaceRoot, relativePath);
    // Security: prevent path traversal outside workspace
    if (!resolved.startsWith(this.workspaceRoot)) {
      throw new Error(`Path traversal detected: ${relativePath} resolves outside workspace`);
    }
    return resolved;
  }

  private async searchWorkspace(args: Record<string, any>): Promise<ToolResult> {
    const { glob: globPattern, query, maxResults = 20 } = args;
    let output = '';

    // File search by glob pattern
    if (globPattern) {
      const files = await vscode.workspace.findFiles(
        globPattern,
        '**/node_modules/**',
        maxResults
      );
      if (files.length === 0) {
        output += `No files found matching pattern: ${globPattern}\n`;
      } else {
        output += `Files matching "${globPattern}":\n`;
        for (const file of files) {
          const rel = path.relative(this.workspaceRoot, file.fsPath);
          output += `  ${rel}\n`;
        }
      }
    }

    // Content search by text query
    if (query) {
      try {
        const grepResult = await this.execCommand(
          `grep -rn --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --include="*.py" --include="*.go" --include="*.java" --include="*.rs" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.md" --include="*.css" --include="*.html" -l "${query.replace(/"/g, '\\"')}" . 2>/dev/null | head -${maxResults}`,
          this.workspaceRoot,
          10000
        );
        if (grepResult.trim()) {
          output += `\nFiles containing "${query}":\n`;
          const files = grepResult.trim().split('\n').slice(0, maxResults);
          for (const file of files) {
            const rel = file.replace(/^\.\//, '');
            output += `  ${rel}\n`;

            // Get matching lines with context
            try {
              const lines = await this.execCommand(
                `grep -n "${query.replace(/"/g, '\\"')}" "${file}" 2>/dev/null | head -5`,
                this.workspaceRoot,
                5000
              );
              if (lines.trim()) {
                for (const line of lines.trim().split('\n')) {
                  output += `    ${line}\n`;
                }
              }
            } catch {
              // skip files we can't read
            }
          }
        } else {
          output += `\nNo files contain "${query}"\n`;
        }
      } catch {
        output += `\nContent search failed for "${query}"\n`;
      }
    }

    if (!globPattern && !query) {
      return { success: false, output: '', error: 'Provide at least one of: glob, query' };
    }

    return { success: true, output: output.trim() };
  }

  private async readFile(args: Record<string, any>): Promise<ToolResult> {
    const { path: filePath, startLine, endLine } = args;
    const resolved = this.resolvePath(filePath);

    if (!fs.existsSync(resolved)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }

    const stat = fs.statSync(resolved);
    if (stat.size > 1024 * 1024) {
      return {
        success: false,
        output: '',
        error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Use startLine/endLine to read a range.`,
      };
    }

    let content = fs.readFileSync(resolved, 'utf8');
    const lines = content.split('\n');

    if (startLine || endLine) {
      const start = Math.max(1, startLine || 1) - 1;
      const end = Math.min(lines.length, endLine || lines.length);
      const sliced = lines.slice(start, end);
      content = sliced.map((line, i) => `${start + i + 1}: ${line}`).join('\n');
    } else if (lines.length > 10000) {
      // Truncate very long files
      const head = lines.slice(0, 200).map((l, i) => `${i + 1}: ${l}`).join('\n');
      const tail = lines.slice(-50).map((l, i) => `${lines.length - 50 + i + 1}: ${l}`).join('\n');
      content = `${head}\n\n... (${lines.length - 250} lines omitted) ...\n\n${tail}`;
    } else {
      content = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
    }

    return { success: true, output: content };
  }

  private async runCommand(args: Record<string, any>): Promise<ToolResult> {
    const { command, cwd, timeout = 30000 } = args;
    const workDir = cwd ? this.resolvePath(cwd) : this.workspaceRoot;

    try {
      const output = await this.execCommand(command, workDir, timeout);
      return { success: true, output: this.truncateOutput(output) };
    } catch (err: any) {
      const output = err.stdout ? `${err.stdout}\n${err.stderr || ''}` : err.message;
      return {
        success: false,
        output: this.truncateOutput(output),
        error: `Command exited with code ${err.code || 1}`,
      };
    }
  }

  private async editFile(args: Record<string, any>): Promise<ToolResult> {
    const { path: filePath, content, description } = args;
    const resolved = this.resolvePath(filePath);
    const isNew = !fs.existsSync(resolved);

    // Create directories if needed
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolved, content, 'utf8');

    // Open the file in editor
    try {
      const doc = await vscode.workspace.openTextDocument(resolved);
      await vscode.window.showTextDocument(doc);
    } catch {
      // Non-critical if opening fails
    }

    const action = isNew ? 'Created' : 'Modified';
    const desc = description ? ` — ${description}` : '';
    return { success: true, output: `${action}: ${filePath}${desc}` };
  }

  private execCommand(command: string, cwd: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          (error as any).stdout = stdout;
          (error as any).stderr = stderr;
          reject(error);
          return;
        }
        resolve(stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''));
      });
    });
  }

  private truncateOutput(output: string, maxLen = 10000): string {
    if (output.length <= maxLen) { return output; }
    const half = Math.floor(maxLen / 2);
    return output.slice(0, half) + `\n\n... (${output.length - maxLen} chars truncated) ...\n\n` + output.slice(-half);
  }
}
