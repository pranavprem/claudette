import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  };
}

// Path to Claude Code credentials (read-only)
// In Docker, ~/.claude is mounted to /root/.claude
const CREDENTIALS_PATH = process.env.CLAUDE_CREDENTIALS_PATH ||
  path.join(os.homedir(), '.claude', '.credentials.json');

/**
 * Read OAuth token from Claude Code credentials.
 * This is READ-ONLY - we never write to this file.
 */
export function getOAuthToken(): string | null {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error(`Credentials file not found: ${CREDENTIALS_PATH}`);
      return null;
    }

    const data = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials: ClaudeCredentials = JSON.parse(data);

    const token = credentials.claudeAiOauth?.accessToken;
    if (!token) {
      console.error('No OAuth token found in credentials');
      return null;
    }

    return token;
  } catch (error) {
    console.error('Failed to read OAuth token:', error);
    return null;
  }
}

/**
 * Check if OAuth token is expired.
 */
export function isTokenExpired(): boolean {
  try {
    const data = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials: ClaudeCredentials = JSON.parse(data);

    const expiresAt = credentials.claudeAiOauth?.expiresAt;
    if (!expiresAt) {
      return false; // Assume valid if no expiry
    }

    // expiresAt is in milliseconds
    return Date.now() > expiresAt;
  } catch {
    return true;
  }
}
