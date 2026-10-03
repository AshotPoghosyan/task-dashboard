import AxeBuilder from '@axe-core/playwright';
import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) - ${v.help}`);
  expect(summary).toEqual([]);
}

const API_URL = 'http://localhost:4000';

/** Posts a signed GitHub `pull_request` webhook, as the real provider would. */
export async function sendGitHubPrWebhook(pr: {
  number: number;
  title: string;
  state?: 'open' | 'closed';
  merged?: boolean;
}): Promise<number> {
  const now = new Date().toISOString();
  const body = JSON.stringify({
    action: pr.state === 'closed' ? 'closed' : 'opened',
    number: pr.number,
    repository: { id: 1, full_name: 'acme/large-web' },
    pull_request: {
      id: 900_000 + pr.number,
      number: pr.number,
      title: pr.title,
      body: '',
      state: pr.state ?? 'open',
      draft: false,
      html_url: `https://example.com/acme/large-web/pull/${pr.number}`,
      user: { id: 1, login: 'e2e-bot', avatar_url: null },
      assignee: null,
      requested_reviewers: [],
      head: { ref: 'feature/e2e' },
      base: { ref: 'main' },
      created_at: now,
      updated_at: now,
      closed_at: pr.state === 'closed' ? now : null,
      merged_at: pr.merged ? now : null,
    },
  });
  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'e2e-github-secret';
  const res = await fetch(`${API_URL}/api/webhooks/github`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-github-delivery': `e2e-${pr.number}-${Date.now()}`,
      'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
    },
    body,
  });
  return res.status;
}
