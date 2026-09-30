# How to use these prompts with Claude Code

1. Create an empty folder. Copy `CLAUDE.md` and `docs/SPEC.md` into it.
   (Claude Code loads CLAUDE.md automatically every session.)
2. For each phase, start a fresh session (`/clear`) and paste the prompt file
   content, or say: "Execute prompts/01-foundation.md".
3. After each phase, run `/clear` and then `prompts/00-review.md`.
4. Review checkpoints: after Phase 2 (database), Phase 4 (API), and Phase 7 (UI look).
   Changes are cheapest there.
5. If you change a requirement, update docs/SPEC.md first, then prompt.
