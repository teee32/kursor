import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolResult } from '../api/types';
import { resolveWorkspacePath } from './workspacePath';
import { runShellCommand } from './runShellCommand';

const SEARCH_INCLUDE_GLOB = '**/*.{ts,js,tsx,jsx,py,go,java,rs,json,yaml,yml,md,css,html}';
const SEARCH_EXCLUDE_GLOB = '**/{node_modules,.git,out}/**';
const DEFAULT_MAX_RESULTS = 20;
const MAX_SEARCH_RESULTS = 100;
const SEARCH_FILE_MULTIPLIER = 10;
const DEFAULT_COMMAND_TIMEOUT = 30000;

export class ToolExecutor {
  constructor(
    private workspaceRoot: string,
    private defaultCommandTimeout = DEFAULT_COMMAND_TIMEOUT
  ) {}

  async execute(
    toolName: string,
    args: Record<string, any>,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'searchWorkspace':
          return await this.searchWorkspace(args);
        case 'readFile':
          return await this.readFile(args);
        case 'runCommand':
          return await this.runCommand(args, signal);
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
    return resolveWorkspacePath(this.workspaceRoot, relativePath);
  }

  private async searchWorkspace(args: Record<string, any>): Promise<ToolResult> {
    const { glob: globPattern, query } = args;
    const maxResults = this.normalizeMaxResults(args.maxResults);
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
      const matches = await this.findTextMatches(String(query), maxResults);
      if (matches.length === 0) {
        output += `\nNo files contain "${query}"\n`;
      } else {
        output += `\nFiles containing "${query}":\n`;
        for (const match of matches) {
          output += `  ${match.file}\n`;
          for (const preview of match.previews) {
            output += `    ${preview}\n`;
          }
        }
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

  private async runCommand(
    args: Record<string, any>,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const { command, cwd, timeout = this.defaultCommandTimeout } = args;
    const workDir = cwd ? this.resolvePath(cwd) : this.workspaceRoot;

    try {
      const output = await runShellCommand(command, workDir, timeout, signal);
      return { success: true, output: this.truncateOutput(output) };
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        return {
          success: false,
          output: 'Command aborted.',
          error: 'Command aborted',
        };
      }

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

  private truncateOutput(output: string, maxLen = 10000): string {
    if (output.length <= maxLen) { return output; }
    const half = Math.floor(maxLen / 2);
    return output.slice(0, half) + `\n\n... (${output.length - maxLen} chars truncated) ...\n\n` + output.slice(-half);
  }

  private normalizeMaxResults(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return DEFAULT_MAX_RESULTS;
    }

    return Math.min(
      MAX_SEARCH_RESULTS,
      Math.max(1, Math.floor(value))
    );
  }

  private async findTextMatches(query: string, maxResults: number): Promise<Array<{
    file: string;
    previews: string[];
  }>> {
    const matches = new Map<string, string[]>();
    const files = await vscode.workspace.findFiles(
      SEARCH_INCLUDE_GLOB,
      SEARCH_EXCLUDE_GLOB,
      Math.min(MAX_SEARCH_RESULTS * SEARCH_FILE_MULTIPLIER, maxResults * SEARCH_FILE_MULTIPLIER)
    );
    const normalizedQuery = query.toLowerCase();

    for (const file of files) {
      if (matches.size >= maxResults) {
        break;
      }

      try {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const previews: string[] = [];
        const lines = content.split(/\r?\n/);

        for (let index = 0; index < lines.length; index += 1) {
          if (!lines[index].toLowerCase().includes(normalizedQuery)) {
            continue;
          }

          previews.push(`${index + 1}: ${lines[index].trim()}`);
          if (previews.length >= 5) {
            break;
          }
        }

        if (previews.length > 0) {
          matches.set(path.relative(this.workspaceRoot, file.fsPath), previews);
        }
      } catch {
        // Skip files that cannot be decoded as UTF-8 text.
      }
    }

    return Array.from(matches.entries()).map(([file, previews]) => ({
      file,
      previews,
    }));
  }
}
