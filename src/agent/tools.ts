import { Tool } from '../api/types';

export const AGENT_TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'searchWorkspace',
      description: 'Search for files and code in the workspace. Use glob patterns to find files by name, or provide a text query to search file contents.',
      parameters: {
        type: 'object',
        properties: {
          glob: {
            type: 'string',
            description: 'Glob pattern to match file paths (e.g. "**/*.ts", "src/**/test.*")',
          },
          query: {
            type: 'string',
            description: 'Text query to search within file contents',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return. Default 20.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: 'Read the full contents of a file at the given path, relative to the workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to workspace root',
          },
          startLine: {
            type: 'number',
            description: 'Optional start line (1-indexed) to read a range',
          },
          endLine: {
            type: 'number',
            description: 'Optional end line (1-indexed) to read a range',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'runCommand',
      description: 'Execute a shell command in the workspace terminal. REQUIRES user approval. Use for running tests, builds, git commands, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
          cwd: {
            type: 'string',
            description: 'Working directory relative to workspace root. Defaults to workspace root.',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds. Defaults to the configured kursor.commandTimeout value.',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editFile',
      description: 'Create or modify a file. REQUIRES user approval. Provide the full new content for the file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to workspace root',
          },
          content: {
            type: 'string',
            description: 'The complete new content for the file',
          },
          description: {
            type: 'string',
            description: 'Brief description of what this edit does',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
];

export const SAFE_TOOLS = new Set(['searchWorkspace', 'readFile']);
export const DANGEROUS_TOOLS = new Set(['runCommand', 'editFile']);
