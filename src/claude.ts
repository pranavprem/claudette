import { spawn } from 'child_process';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: 'stop' | 'length' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: 'assistant'; content?: string };
    finish_reason: 'stop' | 'length' | null;
  }>;
}

export class ClaudeService {
  constructor(private oauthToken: string) {}

  private mapModel(model: string): string | null {
    const modelMap: Record<string, string> = {
      'opus': 'opus',
      'sonnet': 'sonnet',
      'haiku': 'haiku',
      'claude-opus-4-20250514': 'opus',
      'claude-sonnet-4-20250514': 'sonnet',
      'claude-3-5-haiku-20241022': 'haiku',
      'gpt-4': 'opus',
      'gpt-4o': 'sonnet',
      'gpt-4-turbo': 'sonnet',
      'gpt-3.5-turbo': 'haiku',
    };
    return modelMap[model] || null; // null means use default
  }

  private formatPrompt(messages: Message[]): string {
    return messages
      .map(msg => {
        switch (msg.role) {
          case 'system':
            return `System: ${msg.content}`;
          case 'user':
            return msg.content;
          case 'assistant':
            return `Assistant: ${msg.content}`;
          default:
            return msg.content;
        }
      })
      .join('\n\n');
  }

  private generateId(): string {
    return `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Run claude CLI and get response
   */
  private runClaude(prompt: string, model: string | null): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        CLAUDE_CODE_OAUTH_TOKEN: this.oauthToken,
      };

      const args = ['--print', '--output-format', 'text'];
      if (model) {
        args.push('--model', model);
      }
      const proc = spawn('claude', args, { env });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          console.error('Claude stderr:', stderr);
          console.error('Claude stdout:', stdout);
          reject(new Error(stderr || stdout || `claude exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });

      // Write prompt to stdin and close it
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  async completion(model: string, messages: Message[], maxTokens?: number): Promise<ChatCompletion> {
    const prompt = this.formatPrompt(messages);
    const claudeModel = this.mapModel(model);

    const responseText = await this.runClaude(prompt, claudeModel);

    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(responseText.length / 4);

    return {
      id: this.generateId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: responseText },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }

  async *streamCompletion(model: string, messages: Message[], maxTokens?: number): AsyncGenerator<ChatCompletionChunk> {
    const prompt = this.formatPrompt(messages);
    const claudeModel = this.mapModel(model);
    const completionId = this.generateId();
    const created = Math.floor(Date.now() / 1000);

    // Initial chunk with role
    yield {
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null
      }]
    };

    const env = {
      ...process.env,
      CLAUDE_CODE_OAUTH_TOKEN: this.oauthToken,
    };

    const args = ['--print', '--output-format', 'text'];
    if (claudeModel) {
      args.push('--model', claudeModel);
    }
    const proc = spawn('claude', args, { env });

    // Write prompt to stdin and close it
    proc.stdin.write(prompt);
    proc.stdin.end();

    // Stream stdout chunks
    for await (const chunk of proc.stdout) {
      const text = chunk.toString();
      if (text) {
        yield {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{
            index: 0,
            delta: { content: text },
            finish_reason: null
          }]
        };
      }
    }

    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`claude exited with code ${code}`));
      });
      proc.on('error', reject);
    });

    // Final chunk
    yield {
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    };
  }
}
