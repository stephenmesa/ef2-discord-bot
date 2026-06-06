# AGENTS — AI coding agent instructions

Purpose: Provide minimal, actionable guidance for AI coding agents working on this repository.

Quick facts
- Repository type: Node.js (CommonJS), entry: `index.js` ([package.json](package.json)).
- No build/test scripts are defined — check [package.json](package.json) before running tasks.

Key files and folders
- Project README: [README.md](README.md)
- Supabase config: [supabase/config.toml](supabase/config.toml)
- Supabase snippets: [supabase/snippets/](supabase/snippets/)

Conventions for agents
- Link, don't embed: prefer linking to existing docs rather than copying them.
- Minimal by default: add only what's necessary for the task; ask clarifying questions if unsure.
- Avoid changing unrelated files; make minimal, focused edits.
- Use `npm` scripts if present; do not assume a build system exists when `package.json` lacks scripts.
- Always keep documentation up to date when making changes or discovering new information about this repositories.

Common tasks & tips
- When adding features, search for existing commands in [package.json](package.json).
- If tests are missing, propose minimal test harnesses but don't add broad test infra without approval.

Next recommended customizations
- Create small, task-specific instructions under `.github/copilot-instructions.md` for deploy/test workflows.
- Add a `skills/` or `agents/` folder with automation prompts for common tasks.

If anything in this file is unclear or you want additional scope (frontend/backend split, CI details), tell the agent which area to focus on next.

This is a side project that should have the smallest possible financial operational cost. Ideally it will be free to run using the free tier of GCP and the free tier of Supabase.
