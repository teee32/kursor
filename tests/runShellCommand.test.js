const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { runShellCommand } = require('../out/agent/runShellCommand.js');

test('runShellCommand resolves stdout and stderr', async () => {
  const output = await runShellCommand(
    `node -e "process.stdout.write('ok'); process.stderr.write('warn')"`,
    process.cwd(),
    5_000
  );

  assert.equal(output, 'ok\nSTDERR:\nwarn');
});

test('runShellCommand aborts long-running commands', async () => {
  const controller = new AbortController();
  const promise = runShellCommand(
    `node -e "setTimeout(() => {}, 10_000)"`,
    process.cwd(),
    15_000,
    controller.signal
  );

  setTimeout(() => controller.abort(), 50);

  await assert.rejects(promise, (error) => {
    assert.equal(error.name, 'AbortError');
    return true;
  });
});
