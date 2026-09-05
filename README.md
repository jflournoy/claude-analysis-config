# claude-config

Personal [Claude Code](https://docs.claude.com/en/docs/claude-code) configuration: guides,
reviewer agents, and a hook that routes edited files to the reviewer that fits them. Aimed at
reproducible statistical analysis in R, Stan and Python, where the deliverable is a published
number and the bug that matters is the one that does not crash.

No build system — no `package.json`, no npm dependencies. Tests run on `node --test`, which
ships with Node. `--update` and `--adopt` shell out to `git` for the three-way merge and for
reading this repo's history; nothing else does.

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

Copies into `<project>/.claude/`, and records what it copied. Use this where the config has
to travel with the code, or where the project will change it: a repo a collaborator clones,
an analysis that must be reproducible from a container, a devcontainer that cannot see your
`~/.claude` at all.

```bash
node install.js --project ../my-analysis --apply
```

Links to this repo's own files are rewritten so they resolve inside the project: guide links
from `~/.claude/guides/` to `.claude/guides/`, and `~/.claude/CLAUDE.md` to `CLAUDE.md`.
`~/.claude/projects/`, Claude Code's transcript directory, is left alone. Beside the copies it
writes two things:

| Path | What it is |
|---|---|
| `.claude/.claude-config.json` | where this came from, and at which commit |
| `.claude/.baseline/<file>` | a pristine copy of exactly what was written |

The baseline is what turns a later update into a three-way merge instead of an overwrite.
Whether the project commits `.claude/` is its own business — both work the same either way.

### Updating a project that has changed the copies

```bash
node install.js --update ../my-analysis          # dry run
node install.js --update ../my-analysis --apply
```

Baseline is the common ancestor, the project's file is ours, this repo's file is theirs.
Project edits survive, upstream changes arrive, and anything genuinely contested comes back
as conflict markers — nothing picks a side quietly. A file the project deleted stays
deleted; a file it edited with no baseline is skipped, not guessed at; a file this repo has
dropped is reported and left in place.

### Adopting a project that predates all this

A project with a config copied by hand years ago has no baseline. `--adopt` reconstructs
one: for each file it searches **this repo's own history** for the version the project's
copy most resembles, and merges against that.

```bash
node install.js --adopt ../my-analysis           # shows the base it found for each file
node install.js --adopt ../my-analysis --apply
```

The dry run prints the base commit, how many lines the project's copy differs from it, and
what the merge would do — because a three-way merge against a wrong base loses content with
no marker to show for it, so the guess is yours to accept. A base more than half different
from the project's file is not an ancestor; adopt says so and refuses to merge it without
`--force`, installing the current file untouched instead so the old one can be ported by
hand.

It also reports what it will *not* touch: files under the project's `.claude/` that this
repo does not ship, split into stale copies of things we once shipped (safe to delete),
forks of them (a judgement call), and the project's own work (keep). Guides still at the
old `CLAUDE_<name>.md` root path are found, merged into `.claude/guides/`, and left in
place for you to delete.

### All of them are safe by default

Nothing is written without `--apply`. A real file already in place is skipped unless
`--force`, which renames it to a timestamped backup first — in project mode too, so a first
install cannot eat a `CLAUDE.md` the project wrote. Merges back up what they replace. Only
paths this repo owns are touched; `settings.json`, transcripts, and everything else in
`~/.claude` are left alone.

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

No install, no npm dependencies. The suite covers the dispatch table and every failure path,
and checks every agent's frontmatter — the regression test for a real bug where all eight
agents used the wrong schema, loaded silently as nothing, and no one noticed for months.

Vendoring is tested against real git fixtures: every update outcome (fast-forward, clean
merge, conflict, a deletion the project meant, a file with no baseline), and adopt's search
through history, including a guide renamed on its way into this repo. The weak-base
threshold is a test of its own, pinned to the numbers measured on a real adoption — the
guides that genuinely descend from ours sit at 23-38% divergence, the one rewritten from
scratch at 79%.

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