# claude-config

Personal [Claude Code](https://docs.claude.com/en/docs/claude-code) configuration: guides,
reviewer agents, and a hook that routes edited files to the reviewer that fits them. Aimed at
reproducible statistical analysis in R, Stan and Python, where the deliverable is a published
number and the bug that matters is the one that does not crash.

No build system — no `package.json`, no dependencies. Tests run on `node --test`, which
ships with Node.

## Install

Two ways, and the choice is per project.

### System-wide

Symlinks into `~/.claude`, so it applies in every project and editing a file here changes
behavior everywhere at once.

```bash
node install.js --global            # dry run: shows exactly what it would do
node install.js --global --apply
```

Then merge the `PostToolUse` block from `settings.example.json` into your
`~/.claude/settings.json`. That file stays yours — the installer never writes it.

### Per project

Copies into `<project>/.claude/`, pinning a self-contained set the project can commit. Use
this where the config has to travel with the code: a repo a collaborator clones, or an
analysis whose results must be reproducible from a container.

```bash
node install.js --project ../my-analysis --apply
```

Guide links in `CLAUDE.md` are rewritten from `~/.claude/guides/` to `.claude/guides/` so
they resolve inside the project. Copies drift from this repo by design — that is the trade
for pinning.

### Both are safe by default

Nothing is written without `--apply`. A real file already in place is skipped unless
`--force`, which renames it to a timestamped backup first. Only paths this repo owns are
touched; `settings.json`, transcripts, and everything else in `~/.claude` are left alone.

## What's here

### Guides

Loaded on demand — `CLAUDE.md` says when.

| Guide | For |
|---|---|
| `guides/bayesian-production.md` | Writing competent Stan, and making it fast enough to run daily. Every claim carries its evidence class; verified against CmdStan 2.35 and 2.38 |
| `guides/voice.md` | Writing prose a reader sees, in the author's own register |
| `guides/r-development.md` | data.table over tidyverse, targets, testthat; fit with cmdstanr and read with posterior, never the rstan-backed brms accessors |
| `guides/tdd.md`, `guides/standards.md`, `guides/workflow.md` | Test discipline, code quality, collaboration |

### Reviewer agents

Two fire automatically. `hooks/reviewer-dispatch.js` reads the edited path and names the
agent to run:

| Edited | Agent |
|---|---|
| `*.stan` | `stan-reviewer` — nan-filled matrices, parameters with no prior, dropped Jacobians, wasted cycles |
| `*.R` `*.Rmd` `*.qmd` | `r-analysis-reviewer` — joins that lose rows, type coercion, unseeded RNG, stale caches |

Four are on demand: `statistical-analysis-reviewer` (skeptical peer review before a result is
shared), `determinism-reviewer` (work the model is doing that code should), `voice-authenticator`
(prose against the voice profile), `next-priorities`.

All report findings and never edit. `CLAUDE_REVIEWER_DISPATCH=0` silences dispatch for a
session. Adding a file type is one entry in `RULES` plus a test.

### Commands

`/commit`, `/push`, `/hygiene`, `/next`, `/refactor`, `/refactor-verified`.

## Tests

```bash
node --test test/*.test.js
```

No install, no dependencies. The suite covers the dispatch table and every failure path, and
checks every agent's frontmatter — the regression test for a real bug where all eight agents
used the wrong schema, loaded silently as nothing, and no one noticed for months.

## Credit

The shape of this repo and several of its ideas come from Rebecca Murphey.

It began as a fork of [rmurphey/claude-setup](https://github.com/rmurphey/claude-setup),
and the history here still contains that lineage. When she replaced that project with
[rmurphey/claude-config](https://github.com/rmurphey/claude-config) — config that lives at
`~/.claude` rather than being copied per project — this followed, and took several things
with it:

- **Reviewer agents that fire automatically** on a `PostToolUse` hook keyed to the edited
  file's type. The single best idea here.
- **`determinism-reviewer`**, and its principle: never ask the model to do what code can
  verify.
- **`statistical-analysis-reviewer`** and **`voice-authenticator`**, as concepts.
- **The test-integrity policy** — never change a test solely to make it pass.

Those files were written from scratch for this repo's domain (R, Stan, reproducible
analysis) rather than copied, and each carries an attribution comment. Her originals are
better suited to web development and worth reading directly.

Where this diverges deliberately: dispatch lives in a tested lookup table rather than inline
bash, because her own `determinism-reviewer` argues it should; the `.gitignore` is an
allowlist rather than a denylist; and the auto-firing set is two reviewers rather than
fifteen, which is what solo work supports.

## License

MIT — see [LICENSE](LICENSE).