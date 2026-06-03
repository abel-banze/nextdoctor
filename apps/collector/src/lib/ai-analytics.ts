import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { fetchGitHubFile, decryptToken } from './github.js';

const AI_MODEL = process.env.AI_ANALYTICS_MODEL ?? 'gemini-2.5-flash';
const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!API_KEY) {
  console.warn('⚠️ GOOGLE_GENERATIVE_AI_API_KEY is not set. AI analytics will fail.');
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalVisitors: number;
  totalSessions: number;
  totalPageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
}

export interface DailyStat {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
}

export interface TopPage {
  url: string;
  count: number;
}

export interface TrafficSource {
  source: string;
  count: number;
}

export interface BrowserStat {
  browser: string;
  count: number;
}

export interface OsStat {
  os: string;
  count: number;
}

export interface DeviceStat {
  device: string;
  count: number;
}

export interface CountryStat {
  country: string;
  count: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  dailyStats: DailyStat[];
  topPages: TopPage[];
  trafficSources: TrafficSource[];
  browsers: BrowserStat[];
  os: OsStat[];
  devices: DeviceStat[];
  countries: CountryStat[];
}

export interface GitHubInfo {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  accessToken: string;
}

export interface AIInsight {
  category: 'performance' | 'seo' | 'ux' | 'traffic' | 'code_quality';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  suggestion: string;
  codeUrl: string | null;
  metric: string | null;
}

export interface AnalyticsInsightsResult {
  summary: string;
  insights: AIInsight[];
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function generateAnalyticsInsights(
  analytics: AnalyticsData,
  projectName: string,
  github: GitHubInfo | null,
): Promise<AnalyticsInsightsResult> {
  if (!API_KEY) {
    throw new Error('Google Generative AI API key is missing. Please configure GOOGLE_GENERATIVE_AI_API_KEY environment variable.');
  }

  const domain = extractDomain(analytics.topPages[0]?.url ?? '');

  let homepageContent: string | null = null;
  if (domain) {
    try {
      const res = await fetch(`https://${domain}`, {
        headers: { 'User-Agent': 'NextDoctor-Analytics/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();
      homepageContent = html.substring(0, 6000);
    } catch {
      try {
        const res = await fetch(`http://${domain}`, {
          headers: { 'User-Agent': 'NextDoctor-Analytics/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        const html = await res.text();
        homepageContent = html.substring(0, 6000);
      } catch {
        homepageContent = null;
      }
    }
  }

  const { text, usage } = await generateText({
    model: google(AI_MODEL),
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(analytics, projectName, domain, homepageContent, github !== null),
    maxOutputTokens: 4096,
    temperature: 0.3,
    tools: {
      fetchUrl: tool({
        description: 'Fetch any public URL to inspect the live page content, meta tags, HTML structure, or API responses',
        inputSchema: z.object({
          url: z.string().describe('The full public URL to fetch'),
        }),
        execute: async ({ url }) => {
          try {
            const res = await fetch(url, {
              headers: { 'User-Agent': 'NextDoctor-Analytics/1.0' },
              signal: AbortSignal.timeout(10000),
            });
            const text = await res.text();
            return text.substring(0, 8000);
          } catch (err) {
            return `Error fetching URL: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
      fetchGitHubFile: tool({
        description: 'Fetch a source file from the project\'s GitHub repository to analyze performance, SEO, or UX issues in the code',
        inputSchema: z.object({
          filePath: z.string().describe('File path from repo root, e.g. app/dashboard/page.tsx'),
          ref: z.string().optional().describe('Branch or commit SHA, defaults to default branch'),
        }),
        execute: async ({ filePath, ref }) => {
          if (!github) return 'No GitHub repository connected to this project';
          try {
            const file = await fetchGitHubFile(
              github.repoOwner,
              github.repoName,
              filePath,
              ref ?? github.defaultBranch,
              github.accessToken,
            );
            return file.content;
          } catch (err) {
            return `Error fetching file: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    },
  });

  const parsed = parseAiResponse(text);
  return parsed;
}

// ── Prompt builders ─────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an expert Next.js analytics and performance engineer called "NextDoctor".

Your role is to analyze web analytics data (visitors, pageviews, bounce rate, traffic sources, devices, etc.)
and provide **actionable, specific** insights that help developers improve their application.

You have access to TWO tools you can use to gather more information:

1. **fetchUrl** — Fetch any public URL to inspect live page content, meta tags, performance hints, etc.
   Use this when you need to check the actual HTML of the domain or specific pages.
   Extract the domain from the analytics data (top page URLs).

2. **fetchGitHubFile** — If the project has a GitHub repository connected, you can fetch source files.
   Use this when you want to inspect the actual code behind pages with high bounce rates,
   performance issues, or other problems.

Guidelines:
- Focus on insights that are DATA-DRIVEN and SPECIFIC to this project's analytics.
- Don't give generic advice. Every insight must reference actual numbers from the data.
- Identify the TOP 3-5 most impactful issues first, then add secondary insights.
- If bounce rate is high (>50%), investigate what pages are affected.
- Compare traffic sources — if one source dominates, suggest diversifying.
- If mobile usage is high but experience differs from desktop, flag it.
- For performance insights, use fetchUrl to check real page load metrics.

You MUST respond in the following JSON structure — no preamble, no text outside the JSON:

{
  "summary": "2-3 sentence executive summary",
  "insights": [
    {
      "category": "performance" | "seo" | "ux" | "traffic" | "code_quality",
      "severity": "critical" | "warning" | "info",
      "title": "Short, actionable title (max 60 chars)",
      "description": "Detailed explanation referencing specific numbers from the data",
      "suggestion": "Specific action the developer should take",
      "codeUrl": "Full GitHub URL to relevant file (if applicable) or null",
      "metric": "Key metric this relates to (e.g. bounce_rate, pageviews, avg_session_duration)"
    }
  ]
}`;
}

function buildUserPrompt(
  analytics: AnalyticsData,
  projectName: string,
  domain: string | null,
  homepageContent: string | null,
  hasGitHub: boolean,
): string {
  const dailyJson = analytics.dailyStats.map(d => `  { date: ${d.date}, visitors: ${d.visitors}, sessions: ${d.sessions}, pageviews: ${d.pageviews} }`).join('\n');

  return `## Project: ${projectName}
${domain ? `## Domain: ${domain}` : ''}
${hasGitHub ? '## GitHub: Connected (you can use fetchGitHubFile tool)' : '## GitHub: Not connected'}

## Analytics Data (current period)

### Overview
- Total Visitors: ${analytics.overview.totalVisitors}
- Total Sessions: ${analytics.overview.totalSessions}
- Total Pageviews: ${analytics.overview.totalPageviews}
- Bounce Rate: ${analytics.overview.bounceRate}%
- Avg Session Duration: ${formatDuration(analytics.overview.avgSessionDuration)}

${homepageContent ? `### Live Homepage HTML (first 6000 chars)
\`\`\`html
${homepageContent}
\`\`\`` : ''}

### Daily Stats (${analytics.dailyStats.length} days)
\`\`\`
${dailyJson}
\`\`\`

### Top Pages (${analytics.topPages.length})
${analytics.topPages.map(p => `  - ${p.url}: ${p.count} views`).join('\n')}

### Traffic Sources
${analytics.trafficSources.map(s => `  - ${s.source}: ${s.count} visitors`).join('\n')}

### Browsers
${analytics.browsers.map(b => `  - ${b.browser}: ${b.count}`).join('\n')}

### Operating Systems
${analytics.os.map(o => `  - ${o.os}: ${o.count}`).join('\n')}

### Devices
${analytics.devices.map(d => `  - ${d.device}: ${d.count}`).join('\n')}

### Top Countries
${analytics.countries.map(c => `  - ${c.country}: ${c.count}`).join('\n')}

Analyze the data above and use the available tools to gather more information if needed. Return your insights as structured JSON.`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

function parseAiResponse(text: string): AnalyticsInsightsResult {
  try {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ai-analytics] No JSON found in AI response:', text.substring(0, 500));
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate against schema
    const validated = AnalyticsInsightsResultSchema.parse(parsed);
    return validated;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[ai-analytics] Failed to parse AI response:', errorMsg);
    console.error('[ai-analytics] Raw response (first 1000 chars):', text.substring(0, 1000));
    
    throw new Error(`Invalid AI response format: ${errorMsg}`);
  }
}

export const AnalyticsInsightsResultSchema = z.object({
  summary: z.string(),
  insights: z.array(z.object({
    category: z.enum(['performance', 'seo', 'ux', 'traffic', 'code_quality']),
    severity: z.enum(['info', 'warning', 'critical']),
    title: z.string(),
    description: z.string(),
    suggestion: z.string(),
    codeUrl: z.string().nullable(),
    metric: z.string().nullable(),
  })),
});
