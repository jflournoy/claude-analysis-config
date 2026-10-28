'use strict';
/**
 * Vendoring: copy this config into a project, let the project change it, and
 * still be able to take upstream changes later.
 *
 * A vendored project keeps two things beside the installed files:
 *
 *   .claude/.claude-config.json   provenance — where this came from, and when
 *   .claude/.baseline/<rel>       a pristine copy of exactly what was installed
 *
 * The baseline is what makes an update a three-way merge instead of an
 * overwrite: baseline is the common ancestor, the project's file is "ours",
 * the repo's current file is "theirs". Project edits survive; upstream changes
 * arrive; anything genuinely contested comes back as conflict markers rather
 * than a silent choice. Nothing here ever picks a side on its own.
 *
 * Storing the baseline in the project (rather than a commit sha) means an
 * update needs no git history — only the repo's current files — and it works
 * the same whether or not the project commits .claude/.
 *
 * adopt() is for projects that predate all of this. There is no baseline, so
 * it reconstructs one: for each file it searches this repo's own history for
 * the version the project's copy most resembles, and merges against that. The
 * guess is reported and never applied without --apply, because a three-way
 * merge against a wrong base loses content silently.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MANIFEST_REL = path.join('.claude', '.claude-config.json');
const BASELINE_DIR = path.join('.claude', '.baseline');

/** Guides that were renamed on the way into this repo, new name -> old name. */
const LEGACY_GUIDE_NAMES = {
  'r-development': 'r-devel',
  'bayesian-production': 'bayesian-production-tricks',
};

const PAYLOAD_DIRS = ['agents', 'commands', 'hooks', 'guides', 'skills'];

/**
 * Where each item lands, per mode.
 * global : ~/.claude/<rel>            - CLAUDE.md at ~/.claude/CLAUDE.md
 * project: <proj>/.claude/<rel>       - CLAUDE.md at <proj>/CLAUDE.md, since a
 *          project's CLAUDE.md is read from its root, not from .claude/
 */
function destFor(item, mode, root) {
  if (mode === 'global') return path.join(root, item.rel);
  if (item.rel === 'CLAUDE.md') return path.join(root, 'CLAUDE.md');
  return path.join(root, '.claude', item.rel);
}

/**
 * Links to this repo's own files are absolute (~/.claude/...) because a global
 * install is loaded from arbitrary working directories. A project copy keeps those
 * files locally, so the links must be rewritten or they point at the global set —
 * or, where there is no global install, at nothing at all.
 *
 * Only paths this repo ships are rewritten. ~/.claude/projects/ is Claude Code's
 * transcript directory, which stays where it is in either mode.
 */
function rewriteGuidePaths(text, mode) {
  if (mode !== 'project') return text;
  return text
    .split('~/.claude/guides/').join('.claude/guides/')
    .split('~/.claude/CLAUDE.md').join('CLAUDE.md');
}

/**
 * The pre-guides layout kept guides at the project root as CLAUDE_<name>.md.
 * Normalising those links to the current layout before a merge keeps the diff
 * about content rather than about paths.
 */
function rewriteLegacyLinks(text, repo = __dirname) {
  let out = text;
  for (const [current, legacy] of Object.entries(LEGACY_GUIDE_NAMES)) {
    out = out.split(`CLAUDE_${legacy}.md`).join(`.claude/guides/${current}.md`);
  }
  // Only names this repo actually ships as guides. A project's own CLAUDE_spec.md
  // is not ours to move, and rewriting its link points at a file nobody will write.
  let shipped;
  try {
    shipped = fs.readdirSync(path.join(repo, 'guides'))
      .filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  } catch { shipped = Object.keys(LEGACY_GUIDE_NAMES); }
  for (const name of shipped) {
    out = out.split(`CLAUDE_${name}.md`).join(`.claude/guides/${name}.md`);
  }
  return out;
}

/** The body as it would be written into a project, links and all. */
function renderForProject(src) {
  return rewriteGuidePaths(fs.readFileSync(src, 'utf8'), 'project');
}

function manifestPath(root) { return path.join(root, MANIFEST_REL); }
function baselinePath(root, rel) { return path.join(root, BASELINE_DIR, rel); }

/** Missing is a real state; corrupt is not — the second throws rather than reinstalls. */
function readManifest(root) {
  const p = manifestPath(root);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${p} is not valid JSON (${e.message}). Fix or delete it; ` +
                    'do not let an update run against an unreadable manifest.');
  }
}

function writeManifest(root, repo, extra = {}) {
  const head = git(repo, ['rev-parse', 'HEAD'], { allowFail: true });
  const dirty = git(repo, ['status', '--porcelain'], { allowFail: true });
  const data = {
    source: repo,
    sourceCommit: head ? head.trim() : null,
    sourceDirty: Boolean(dirty && dirty.trim()),
    updated: new Date().toISOString(),
    ...extra,
  };
  fs.mkdirSync(path.dirname(manifestPath(root)), { recursive: true });
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

function readBaseline(root, rel) {
  const p = baselinePath(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function writeBaseline(root, rel, body) {
  const p = baselinePath(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

function readIf(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }

function backupPath(dest) {
  return `${dest}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

/** git, with failure surfaced rather than swallowed unless the caller opts out. */
function git(repo, args, { allowFail = false } = {}) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed in ${repo}: ${(r.stderr || '').trim()}`);
  }
  return r.stdout;
}

function withTempFiles(bodies, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-config-'));
  try {
    const paths = bodies.map((b, i) => {
      const p = path.join(dir, `f${i}`);
      fs.writeFileSync(p, b);
      return p;
    });
    return fn(paths);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Added + deleted lines between two bodies. Used to pick the closest ancestor. */
function diffSize(a, b) {
  if (a === b) return 0;
  return withTempFiles([a, b], ([pa, pb]) => {
    const r = spawnSync('git', ['diff', '--no-index', '--numstat', '--', pa, pb],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw r.error;
    if (r.status !== 1 && r.status !== 0) {
      throw new Error(`git diff --no-index failed: ${(r.stderr || '').trim()}`);
    }
    const line = r.stdout.split('\n').find((l) => l.trim());
    if (!line) return 0;
    const [add, del] = line.split('\t');
    if (add === '-' || del === '-') return Number.MAX_SAFE_INTEGER;
    return Number(add) + Number(del);
  });
}

/** Three-way merge. Conflicts come back as markers in the text, never resolved for you. */
function merge3(ours, base, theirs) {
  return withTempFiles([ours, base, theirs], ([po, pb, pt]) => {
    const r = spawnSync('git', ['merge-file', '-p', '--diff3',
      '-L', 'project', '-L', 'baseline', '-L', 'upstream', po, pb, pt],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw r.error;
    if (r.status === null || r.status >= 255) {
      throw new Error(`git merge-file failed: ${(r.stderr || '').trim()}`);
    }
    const text = r.stdout;
    return { text, conflicts: (text.match(/^<{7} /gm) || []).length };
  });
}

/**
 * What an update would do to each installed file.
 *
 * unchanged      upstream has not moved since the baseline
 * current        the project already has upstream's version
 * fast-forward   the project never edited it; take upstream
 * merged         both moved, and the merge is clean
 * conflict       both moved and disagree; markers get written
 * add            new upstream file the project does not have
 * removed        the project deleted it; deletions are honoured, not undone
 * no-baseline    a file we cannot merge safely — adopt has not been run
 */
function updatePlan(root, items) {
  return items.map((item) => {
    const rel = item.rel;
    const dest = destFor(item, 'project', root);
    const upstream = renderForProject(item.src);
    const base = readBaseline(root, rel);
    const ours = readIf(dest);
    const e = { rel, src: item.src, dest, upstream, base, ours };

    if (base === null) {
      return ours === null ? { ...e, action: 'add' } : { ...e, action: 'no-baseline' };
    }
    if (ours === null) {
      return { ...e, action: 'removed', upstreamMoved: base !== upstream };
    }
    if (base === upstream) return { ...e, action: 'unchanged' };
    if (ours === upstream) return { ...e, action: 'current' };
    if (ours === base) return { ...e, action: 'fast-forward' };
    const m = merge3(ours, base, upstream);
    return { ...e, action: m.conflicts ? 'conflict' : 'merged', merged: m.text, conflicts: m.conflicts };
  });
}

/** Files with a baseline that upstream no longer ships. Reported, never deleted. */
function orphanedBaselines(root, items) {
  const dir = path.join(root, BASELINE_DIR);
  if (!fs.existsSync(dir)) return [];
  const known = new Set(items.map((i) => i.rel));
  const out = [];
  const walk = (sub) => {
    for (const f of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? path.join(sub, f.name) : f.name;
      if (f.isDirectory()) walk(rel);
      else if (!known.has(rel)) out.push(rel);
    }
  };
  walk('');
  return out;
}

/**
 * Write an update. Conflicted files get markers and a backup of what the
 * project had; the baseline advances to upstream either way, so the next
 * update merges against what is now installed rather than re-offering the
 * same change.
 */
function applyUpdate(root, entries, { log = console.log } = {}) {
  const counts = {};
  for (const e of entries) {
    counts[e.action] = (counts[e.action] || 0) + 1;
    switch (e.action) {
      case 'unchanged':
        break;
      case 'removed':
        if (e.upstreamMoved) {
          log(`  GONE     ${e.rel} — you removed it; upstream has changed it since. Left removed.`);
        }
        break;
      case 'no-baseline':
        log(`  SKIP     ${e.rel} — no baseline to merge against; run --adopt first`);
        break;
      case 'current':
        writeBaseline(root, e.rel, e.upstream);
        break;
      case 'add':
      case 'fast-forward':
      case 'merged':
      case 'conflict': {
        const merging = e.action === 'merged' || e.action === 'conflict';
        if (merging) {
          const b = backupPath(e.dest);
          fs.copyFileSync(e.dest, b);
          log(`  BACKUP   ${e.rel} -> ${path.basename(b)}`);
        }
        fs.mkdirSync(path.dirname(e.dest), { recursive: true });
        fs.writeFileSync(e.dest, merging ? e.merged : e.upstream);
        writeBaseline(root, e.rel, e.upstream);
        log(`  ${e.action.toUpperCase().padEnd(8)} ${e.rel}` +
            (e.action === 'conflict' ? ` — ${e.conflicts} conflict(s) to resolve by hand` : ''));
        break;
      }
      default:
        throw new Error(`unknown update action: ${e.action}`);
    }
  }
  return counts;
}

/* ---------------------------------------------------------------- adopt --- */

function legacyGuideName(name) {
  return LEGACY_GUIDE_NAMES[name] || name;
}

/** Everywhere a project might already keep this file, current layout first. */
function projectCandidates(root, rel) {
  const dest = destFor({ rel }, 'project', root);
  if (!rel.startsWith('guides/')) return [dest];
  const name = path.basename(rel, '.md');
  return [...new Set([
    dest,
    path.join(root, `CLAUDE_${legacyGuideName(name)}.md`),
    path.join(root, `CLAUDE_${name}.md`),
  ])];
}

/** Every path this file has lived at in this repo's history. */
function historyPaths(rel) {
  const out = [rel, path.join('.claude', rel)];
  if (rel.startsWith('guides/')) {
    const name = path.basename(rel, '.md');
    out.push(`CLAUDE_${legacyGuideName(name)}.md`, `CLAUDE_${name}.md`);
  }
  return [...new Set(out)];
}

/** Put every side of a merge into the same link space before comparing them. */
function normalize(text) {
  return rewriteLegacyLinks(rewriteGuidePaths(text, 'project'));
}

/**
 * The version in this repo's history that the project's copy most resembles.
 * Distance is added+deleted lines; ties go to the first path checked, which is
 * the current layout. Returns null when the file has no history here at all.
 */
function findBase(repo, rel, ours) {
  let best = null;
  for (const p of historyPaths(rel)) {
    const log = git(repo, ['log', '--all', '--format=%H', '--', p], { allowFail: true });
    if (!log) continue;
    const blobs = new Map();
    for (const c of log.split('\n').filter(Boolean)) {
      const sha = git(repo, ['rev-parse', `${c}:${p}`], { allowFail: true });
      if (sha && !blobs.has(sha.trim())) blobs.set(sha.trim(), c);
    }
    for (const [sha, commit] of blobs) {
      const body = normalize(git(repo, ['cat-file', 'blob', sha]));
      const distance = diffSize(body, ours);
      if (!best || distance < best.distance) {
        best = { commit: commit.slice(0, 7), path: p, blob: sha, body, distance };
      }
    }
  }
  return best;
}

function lineCount(s) {
  const t = s.endsWith('\n') ? s.slice(0, -1) : s;
  return t === '' ? 0 : t.split('\n').length;
}

/**
 * How far the best base is from the project's copy, as a share of the two
 * files' length. Calibrated against this repo's own history: guides that really
 * do descend from the base land at 0.23-0.38, while a guide that was rewritten
 * from scratch rather than edited lands at 0.79. Past this, the "ancestor" is
 * a coincidence and the merge would be fiction.
 */
const WEAK_BASE_RATIO = 0.5;

function divergence(distance, ours, base) {
  const denom = lineCount(ours) + lineCount(base);
  if (!denom) return distance ? 1 : 0;
  return distance / denom;
}

/**
 * What adopting would do, file by file, with the reconstructed base shown for
 * each one. Computes the merge but writes nothing — the caller prints this and
 * waits for --apply, because a merge against a wrong base loses content with
 * no marker to show for it.
 *
 * new          upstream file the project has never had
 * merge        base found; project edits and upstream changes combined
 * no-ancestor  nothing in history resembles it; port by hand
 */
function adoptPlan(root, repo, items) {
  return items.map((item) => {
    const rel = item.rel;
    const dest = destFor(item, 'project', root);
    const upstream = renderForProject(item.src);
    const theirs = normalize(upstream);
    const oursPath = projectCandidates(root, rel).find((p) => fs.existsSync(p)) || null;
    const e = { rel, src: item.src, dest, upstream, oursPath, legacy: Boolean(oursPath) && oursPath !== dest };

    if (!oursPath) return { ...e, action: 'new' };

    const ours = normalize(fs.readFileSync(oursPath, 'utf8'));
    const base = findBase(repo, rel, ours);
    if (!base) return { ...e, action: 'no-ancestor', ours };

    const m = merge3(ours, base.body, theirs);
    return {
      ...e,
      action: 'merge',
      ours,
      base,
      divergence: divergence(base.distance, ours, base.body),
      weak: divergence(base.distance, ours, base.body) > WEAK_BASE_RATIO,
      merged: m.text,
      conflicts: m.conflicts,
    };
  });
}

/**
 * Project files under .claude/ that upstream does not ship, classified against
 * this repo's history so the project can tell its own work from stale copies of
 * ours. Read-only: adopt never touches these.
 *
 * stale        byte-identical to a version we once shipped — safe to delete
 * edited-fork  descends from a version we shipped, but was changed here
 * original     no ancestor here; the project wrote it
 */
function projectExtras(root, repo, items) {
  const known = new Set(items.map((i) => destFor(i, 'project', root)));
  const out = [];
  for (const dir of PAYLOAD_DIRS) {
    const abs = path.join(root, '.claude', dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs, { withFileTypes: true })) {
      if (f.isDirectory() || f.name.startsWith('.') || !f.name.endsWith('.md')) continue;
      const full = path.join(abs, f.name);
      if (known.has(full)) continue;
      const rel = path.join(dir, f.name);
      const ours = normalize(fs.readFileSync(full, 'utf8'));
      const base = findBase(repo, rel, ours);
      const kind = !base ? 'original' : base.distance === 0 ? 'stale' : 'edited-fork';
      out.push({ rel, path: full, kind, base });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Write an adoption. A base flagged weak is treated as no base at all: merging
 * against a file that only coincidentally resembles the project's would produce
 * plausible text with content silently dropped, which is worse than doing
 * nothing. --force overrides, having seen the number in the dry run.
 */
function applyAdopt(root, repo, entries, { log = console.log, force = false } = {}) {
  const counts = {};
  for (const e of entries) {
    counts[e.action] = (counts[e.action] || 0) + 1;
    if (e.action === 'merge' && e.weak && !force) {
      log(`  SKIP     ${e.rel} — base is ${(e.divergence * 100).toFixed(0)}% different; ` +
          `not a real ancestor. Port ${path.relative(root, e.oursPath)} by hand, or --force.`);
      counts.skipped = (counts.skipped || 0) + 1;
      if (e.legacy && !fs.existsSync(e.dest)) {
        fs.mkdirSync(path.dirname(e.dest), { recursive: true });
        fs.writeFileSync(e.dest, e.upstream);
        writeBaseline(root, e.rel, e.upstream);
        log(`  INSTALL  ${e.rel} — upstream copy only; nothing was merged into it`);
      }
      continue;
    }
    if (e.action === 'no-ancestor') {
      const hand = path.relative(root, e.oursPath);
      // A legacy file at another path can be left for a hand port while the
      // current-layout file installs cleanly. One at the same path cannot:
      // installing would destroy the very edits there is no base to merge.
      if (e.legacy && !fs.existsSync(e.dest)) {
        fs.mkdirSync(path.dirname(e.dest), { recursive: true });
        fs.writeFileSync(e.dest, e.upstream);
        writeBaseline(root, e.rel, e.upstream);
        log(`  INSTALL  ${e.rel} — no ancestor; port ${hand} by hand, nothing was merged`);
      } else {
        log(`  SKIP     ${e.rel} — no ancestor in history; port ${hand} by hand`);
      }
      continue;
    }
    if (e.action === 'merge' && fs.existsSync(e.dest)) {
      const b = backupPath(e.dest);
      fs.copyFileSync(e.dest, b);
      log(`  BACKUP   ${e.rel} -> ${path.basename(b)}`);
    }
    fs.mkdirSync(path.dirname(e.dest), { recursive: true });
    fs.writeFileSync(e.dest, e.action === 'merge' ? e.merged : e.upstream);
    writeBaseline(root, e.rel, e.upstream);
    const note = e.action === 'merge' && e.conflicts ? ` — ${e.conflicts} conflict(s) to resolve by hand`
      : e.legacy ? ` — supersedes ${path.relative(root, e.oursPath)}` : '';
    log(`  ${e.action.toUpperCase().padEnd(8)} ${e.rel}${note}`);
  }
  return counts;
}

module.exports = {
  MANIFEST_REL, BASELINE_DIR, LEGACY_GUIDE_NAMES, PAYLOAD_DIRS,
  destFor, rewriteGuidePaths, rewriteLegacyLinks, renderForProject, normalize,
  manifestPath, baselinePath, readManifest, writeManifest, readBaseline, writeBaseline,
  backupPath, git, diffSize, merge3, lineCount, divergence, WEAK_BASE_RATIO,
  updatePlan, orphanedBaselines, applyUpdate,
  projectCandidates, historyPaths, findBase, adoptPlan, projectExtras, applyAdopt,
};
