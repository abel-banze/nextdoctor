import { env } from '../config.js';

export interface GitHubFileContent {
  path: string;
  content: string;
  sha: string;
  url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  isPrivate: boolean;
}

async function githubApiRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nextdoctor-collector/1.0',
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status} for ${path}: ${body}`);
  }

  return JSON.parse(body) as T;
}

export async function fetchGitHubRepos(accessToken: string): Promise<GitHubRepository[]> {
  const repos = await githubApiRequest<Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    owner: {
      login: string;
    };
  }>>('/user/repos?per_page=100&sort=updated&visibility=all', accessToken);

  return repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    owner: repo.owner.login,
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    isPrivate: repo.private,
  }));
}

export async function fetchGitHubRepository(
  owner: string,
  name: string,
  accessToken: string,
): Promise<GitHubRepository> {
  const repo = await githubApiRequest<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    owner: {
      login: string;
    };
  }>(`/repos/${owner}/${name}`, accessToken);

  return {
    id: repo.id,
    name: repo.name,
    owner: repo.owner.login,
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    isPrivate: repo.private,
  };
}

/**
 * Fetch raw file content from a GitHub repository using the GitHub API.
 * Uses an encrypted access token stored in github_connections.
 *
 * @param repoOwner  - GitHub org/user, e.g. 'acme-corp'
 * @param repoName   - Repo name, e.g. 'my-next-app'
 * @param filePath   - File path from repo root, e.g. 'app/dashboard/page.tsx'
 * @param ref        - Branch or commit SHA (default: 'main')
 * @param accessToken - Decrypted GitHub OAuth token or App installation token
 */
export async function fetchGitHubFile(
  repoOwner: string,
  repoName: string,
  filePath: string,
  ref: string,
  accessToken: string,
): Promise<GitHubFileContent> {
  const data = await githubApiRequest<{
    path: string;
    sha: string;
    html_url: string;
    content: string;
    encoding: string;
  }>(`/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${encodeURIComponent(ref)}`, accessToken);

  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected encoding from GitHub: ${data.encoding}`);
  }

  const content = Buffer.from(data.content, 'base64').toString('utf-8');

  return {
    path: data.path,
    content,
    sha: data.sha,
    url: data.html_url,
  };
}

/**
 * Decrypt a GitHub access token stored as AES-256-GCM hex in the database.
 * The token is encrypted at storage time using NEXTDOCTOR_SECRET.
 */
export async function decryptToken(encryptedHex: string): Promise<string> {
  const { createDecipheriv } = await import('crypto').then(m => m);
  // Format: iv(32 hex chars) + ':' + authTag(32 hex chars) + ':' + ciphertext
  const [ivHex, authTagHex, cipherHex] = encryptedHex.split(':');
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error('Invalid encrypted token format');
  }
  const key = Buffer.from(env.NEXTDOCTOR_SECRET.slice(0, 32), 'utf8');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(cipherHex, 'hex', 'utf8') + decipher.final('utf8');
}

/**
 * Encrypt a GitHub access token for storage in the database.
 */
export function encryptToken(rawToken: string): string {
  const { createCipheriv, randomBytes } = require('crypto');
  const key = Buffer.from(env.NEXTDOCTOR_SECRET.slice(0, 32), 'utf8');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = cipher.update(rawToken, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}
