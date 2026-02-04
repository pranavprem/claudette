import express, { Request, Response, NextFunction } from 'express';
import { ClaudeService } from './claude';
import { getOAuthToken } from './auth';

const PORT = process.env.PORT || 5766;
const API_KEY = process.env.API_KEY || 'sk-local-proxy-key';

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API key validation middleware
function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.headers['x-api-key'];

  if (apiKey !== API_KEY) {
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        type: 'authentication_error',
        code: 'invalid_api_key'
      }
    });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  const token = getOAuthToken();
  res.json({
    status: 'healthy',
    authenticated: !!token,
    timestamp: new Date().toISOString()
  });
});

app.get('/v1/health', (req, res) => {
  const token = getOAuthToken();
  res.json({
    status: 'healthy',
    authenticated: !!token,
    timestamp: new Date().toISOString()
  });
});

// List models
app.get('/v1/models', validateApiKey, (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'claude-sonnet-4-20250514',
        object: 'model',
        created: 1731888000,
        owned_by: 'anthropic'
      },
      {
        id: 'claude-opus-4-20250514',
        object: 'model',
        created: 1731888000,
        owned_by: 'anthropic'
      },
      {
        id: 'claude-3-5-haiku-20241022',
        object: 'model',
        created: 1729555200,
        owned_by: 'anthropic'
      },
      // Aliases
      {
        id: 'sonnet',
        object: 'model',
        created: 1731888000,
        owned_by: 'anthropic'
      },
      {
        id: 'opus',
        object: 'model',
        created: 1731888000,
        owned_by: 'anthropic'
      },
      {
        id: 'haiku',
        object: 'model',
        created: 1729555200,
        owned_by: 'anthropic'
      }
    ]
  });
});

// Chat completions
app.post('/v1/chat/completions', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { model, messages, stream, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'messages array is required',
          type: 'invalid_request_error',
          code: 'invalid_messages'
        }
      });
    }

    const oauthToken = getOAuthToken();
    if (!oauthToken) {
      return res.status(401).json({
        error: {
          message: 'No OAuth token available. Ensure Claude Code is authenticated.',
          type: 'authentication_error',
          code: 'no_oauth_token'
        }
      });
    }

    const claude = new ClaudeService(oauthToken);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      try {
        for await (const chunk of claude.streamCompletion(model, messages, max_tokens)) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Stream error';
        res.write(`data: ${JSON.stringify({ error: { message: errorMsg } })}\n\n`);
        res.end();
      }
    } else {
      const completion = await claude.completion(model, messages, max_tokens);
      res.json(completion);
    }
  } catch (error) {
    console.error('Chat completion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('rate limit')) {
      return res.status(429).json({
        error: { message: 'Rate limit exceeded', type: 'rate_limit_error' }
      });
    }

    res.status(500).json({
      error: { message, type: 'api_error', code: 'internal_error' }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      type: 'invalid_request_error',
      code: 'not_found'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Claudette running on http://localhost:${PORT}`);
  console.log(`OpenAI-compatible endpoint: http://localhost:${PORT}/v1`);

  const token = getOAuthToken();
  if (token) {
    console.log(`OAuth token loaded: ...${token.slice(-4)}`);
  } else {
    console.log('WARNING: No OAuth token found. Run "claude login" first.');
  }
});
