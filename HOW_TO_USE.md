# How to run the build with the Claude GitHub agent

## One-time setup
1. Install the Claude GitHub App on the `mr-task-dashboard` repo:
   https://github.com/apps/claude
2. Add ONE secret in repo Settings → Secrets and variables → Actions:
   - Claude Pro/Max: run `claude setup-token` on any computer with Claude Code,
     save the result as `CLAUDE_CODE_OAUTH_TOKEN`.
   - Or an API key from console.anthropic.com as `ANTHROPIC_API_KEY`
     (then switch the commented line in .github/workflows/claude.yml).
3. Settings → Actions → General → Workflow permissions: "Read and write permissions"
   and tick "Allow GitHub Actions to create and approve pull requests".
4. Upload everything in this folder to the repo root (including `.github/`).

## Each phase
1. New issue, title: `Phase 1 – Foundation`.
2. Body: `@claude Execute prompts/01-foundation.md. Open a PR when done.`
3. Wait for the PR. Check the CI result and the phase report.
4. On the PR, comment: `@claude Execute prompts/00-review.md for this PR.`
5. Merge the PR. Start the next phase.

## Checkpoints
Stop and review with me after Phase 2 (schema.prisma), Phase 4 (API report),
Phase 7 (UI screenshots – run it locally or ask the agent for a Playwright screenshot).
