const test = require('node:test');
const assert = require('node:assert/strict');

const { AgentLoop } = require('../out/agent/agentLoop.js');

function createToolCall() {
  return {
    id: 'call_1',
    type: 'function',
    function: {
      name: 'runCommand',
      arguments: '{"command":"echo hi"}',
    },
  };
}

test('AgentLoop does not report max-iteration errors after a normal final response', async () => {
  const errors = [];
  let calls = 0;

  const loop = new AgentLoop(
    {
      async chatStreamWithTools() {
        calls += 1;
        return {
          textContent: 'done',
          toolCalls: null,
          assistantMessage: { role: 'assistant', content: 'done' },
          finishReason: 'stop',
        };
      },
    },
    {
      async execute() {
        throw new Error('execute should not be called');
      },
    },
    {
      onTextChunk() {},
      onToolCallStart() {},
      onToolCallComplete() {},
      onApprovalRequired() {
        return Promise.resolve(true);
      },
      onComplete() {},
      onError(error) {
        errors.push(error.message);
      },
    },
    1
  );

  const result = await loop.run([{ role: 'system', content: 'test' }]);

  assert.equal(calls, 1);
  assert.equal(errors.length, 0);
  assert.equal(result.at(-1).content, 'done');
});

test('AgentLoop exits promptly when aborted during approval', async () => {
  const abortController = new AbortController();
  let toolExecutions = 0;
  let toolCompletions = 0;
  let completed = 0;

  const loop = new AgentLoop(
    {
      async chatStreamWithTools() {
        return {
          textContent: '',
          toolCalls: [createToolCall()],
          assistantMessage: {
            role: 'assistant',
            content: '',
            tool_calls: [createToolCall()],
          },
          finishReason: 'tool_calls',
        };
      },
    },
    {
      async execute() {
        toolExecutions += 1;
        return { success: true, output: 'unexpected' };
      },
    },
    {
      onTextChunk() {},
      onToolCallStart() {
        abortController.abort();
      },
      onToolCallComplete() {
        toolCompletions += 1;
      },
      onApprovalRequired() {
        return new Promise(() => {});
      },
      onComplete() {
        completed += 1;
      },
      onError(error) {
        throw error;
      },
    },
    3
  );

  const result = await Promise.race([
    loop.run([{ role: 'system', content: 'test' }], abortController.signal),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AgentLoop did not stop after abort')), 200)
    ),
  ]);

  assert.equal(toolExecutions, 0);
  assert.equal(toolCompletions, 0);
  assert.equal(completed, 1);
  assert.equal(result.some((message) => message.role === 'tool'), false);
});
