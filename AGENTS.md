<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git discipline — MANDATORY

After every session that modifies files you MUST:
1. `git add` the changed files (prefer specific paths over `-A`)
2. `git commit` with a clear message describing what changed and why
3. `git push origin main` to deploy to Vercel

Never leave a session with uncommitted changes. The Stop hook runs `auto-commit.ps1`
automatically, but always verify with `git status` before ending — the hook only stages
tracked files (`git add --update`) and will skip untracked new files.

If you add a new file, stage it explicitly before or after the hook runs.
