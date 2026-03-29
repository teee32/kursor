const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveWorkspacePath } = require('../out/agent/workspacePath.js');

test('resolveWorkspacePath keeps files inside the workspace', () => {
  const workspaceRoot = path.join(path.sep, 'tmp', 'project');
  const resolved = resolveWorkspacePath(workspaceRoot, 'src/index.ts');

  assert.equal(resolved, path.join(workspaceRoot, 'src', 'index.ts'));
});

test('resolveWorkspacePath rejects prefix-collision escapes', () => {
  const workspaceRoot = path.join(path.sep, 'tmp', 'project');

  assert.throws(
    () => resolveWorkspacePath(workspaceRoot, '../project-other/secrets.txt'),
    /outside workspace/
  );
});
