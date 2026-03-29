import { exec } from 'child_process';

export function runShellCommand(
  command: string,
  cwd: string,
  timeout: number,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024,
        signal,
      },
      (error, stdout, stderr) => {
        if (error) {
          (error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }).stdout = stdout;
          (error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }).stderr = stderr;
          reject(error);
          return;
        }

        resolve(stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''));
      }
    );
  });
}
