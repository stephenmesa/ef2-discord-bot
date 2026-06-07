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

Follow 12-factor app principles whenever reasonable.

If you encounter scenarios where you don't know the best path forward, consult with the operator to achieve clarity rather than taking a guess.

Compact numbers are a concept from within the Endless Frontier 2 game. It acts as a variation on scientific notation. a number proceeded by a letter to indicate how many decimal places should move. The letter `a` refers to multiplying by 10^3, `b` is 10^6, `c` is 10^9. It can even go into multiple letters, such as `aa` referring to 10^81. The general formula is 10^(3N) where N is the index of the letter(s) after the number. When representing a number in the compact form, the coefficient should always be exactly three digits with an optional decimal. For example, the following are not correct: 4.567 45.67 456.7, but the following are correct: 4.56, 45.6, 456
