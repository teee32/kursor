import * as path from 'path';

export function resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, targetPath);
  const relative = path.relative(root, resolved);

  if (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  ) {
    return resolved;
  }

  throw new Error(
    `Path traversal detected: ${targetPath} resolves outside workspace`
  );
}
