import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiAnalyses, issues, githubConnections } from '../db/schema.js';
import { fetchGitHubFile, decryptToken } from './github.js';

export type AiDoctorInput = {
  issueId: string;
  projectId: string;
  tenantId: string;
};

/**
 * Run the AI Doctor for a given issue.
 *
 * Flow:
 * 1. Load the issue + GitHub connection for the project
 * 2. Infer the likely source file from the issue route
 * 3. Fetch source from GitHub
 * 4. Call Claude to explain the problem and generate a diff fix
 * 5. Persist the result in ai_analyses
 *
 * This function is designed to be called in the background (fire-and-forget
 * from the ingest route) or triggered manually from the dashboard.
 */
export async function runAiDoctor(input: AiDoctorInput): Promise<void> {
  const { issueId, projectId, tenantId } = input;

  // 1. Load the issue
  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) throw new Error(`Issue ${issueId} not found`);

  // 2. Load the GitHub connection for this project
  const [connection] = await db
    .select()
    .from(githubConnections)
    .where(eq(githubConnections.projectId, projectId))
    .limit(1);

  if (!connection || !connection.isActive) {
    throw new Error(`No active GitHub connection for project ${projectId}`);
  }

  // Create the analysis record in pending state
  const [analysis] = await db.insert(aiAnalyses).values({
    issueId,
    projectId,
    tenantId,
    githubConnectionId: connection.id,
    model: 'claude-sonnet-4-5',
    status: 'pending',
  }).returning();

  if (!analysis) throw new Error('Failed to create analysis record');

  try {
    // 3. Infer likely file path from the route
    // e.g.  /dashboard         → app/dashboard/page.tsx
    //       /api/products      → app/api/products/route.ts
    const filePath = routeToFilePath(issue.route);

    // 4. Fetch the source file from GitHub
    const accessToken = await decryptToken(connection.accessTokenEncrypted);
    const file = await fetchGitHubFile(
      connection.repoOwner,
      connection.repoName,
      filePath,
      connection.defaultBranch,
      accessToken,
    );

    // 5. Build the prompt and call Claude
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({ issue, file });

    const { text, usage } = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 2048,
      temperature: 0.2,
    });

    // Parse the structured response
    const parsed = parseAiResponse(text);

    // 6. Persist completed analysis
    await db.update(aiAnalyses)
      .set({
        filePath: file.path,
        fileCommitSha: file.sha,
        startLine: parsed.startLine,
        endLine: parsed.endLine,
        explanation: parsed.explanation,
        diff: parsed.diff,
        fixedSnippet: parsed.fixedSnippet,
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(aiAnalyses.id, analysis.id));

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(aiAnalyses)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(aiAnalyses.id, analysis.id));
    throw err;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Next.js route to its most likely App Router source file.
 * Heuristic-based — works for standard Next.js 13+ App Router layouts.
 */
function routeToFilePath(route: string | null): string {
  if (!route) return 'app/page.tsx';

  const clean = route.replace(/^\//, '').replace(/\/$/, '');

  // API routes → route.ts
  if (clean.startsWith('api/')) {
    return `app/${clean}/route.ts`;
  }

  // Everything else → page.tsx
  return clean ? `app/${clean}/page.tsx` : 'app/page.tsx';
}

function buildSystemPrompt(): string {
  return `You are NextDoctor, an expert Next.js performance engineer.
You help developers fix performance anti-patterns in their Next.js App Router code.

You will be given:
1. A detected performance issue with a message and suggestion
2. The source file content from their GitHub repository

Your task is to analyse the code and produce a fix.

ALWAYS respond in EXACTLY this XML format — no preamble, no explanation outside the tags:

<analysis>
  <explanation>One concise sentence explaining why this specific code causes the problem.</explanation>
  <startLine>Integer — first line of the problematic code block</startLine>
  <endLine>Integer — last line of the problematic code block</endLine>
  <diff>
A unified diff of the minimal change needed to fix the issue.
Use --- a/filepath and +++ b/filepath headers.
  </diff>
  <fixedSnippet>
The complete fixed version of the problematic function or component, ready to copy-paste.
  </fixedSnippet>
</analysis>`;
}

function buildUserPrompt({ issue, file }: {
  issue: { detectorId: string; message: string; suggestion: string; route: string | null };
  file: { path: string; content: string };
}): string {
  return `## Detected Issue

**Detector:** ${issue.detectorId}
**Route:** ${issue.route ?? 'unknown'}
**Message:** ${issue.message}
**Suggestion:** ${issue.suggestion}

## Source File: ${file.path}

\`\`\`tsx
${file.content}
\`\`\`

Analyse the code above and produce the fix.`;
}

interface ParsedAiResponse {
  explanation: string | null;
  startLine: number | null;
  endLine: number | null;
  diff: string | null;
  fixedSnippet: string | null;
}

function parseAiResponse(text: string): ParsedAiResponse {
  const extract = (tag: string): string | null => {
    const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return match?.[1]?.trim() ?? null;
  };

  return {
    explanation: extract('explanation'),
    startLine: Number(extract('startLine')) || null,
    endLine: Number(extract('endLine')) || null,
    diff: extract('diff'),
    fixedSnippet: extract('fixedSnippet'),
  };
}
