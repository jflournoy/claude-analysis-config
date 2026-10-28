#!/usr/bin/env node
/**
 * Install this config system-wide, or vendor it into a single project.
 *
 *   node install.js --global               # dry run
 *   node install.js --global --apply       # symlink into ~/.claude
 *   node install.js --project ../my-repo --apply   # copy into <repo>/.claude
 *   node install.js --update  ../my-repo           # take upstream changes, keeping the project's
 *   node install.js --adopt   ../my-repo           # bring a pre-vendoring project in
 *
 * Global uses symlinks: one source of truth, edits here take effect everywhere.
 * Project uses copies, plus a baseline of exactly what was copied, so the
 * project can change anything and still take upstream changes later — see
 * vendor.js. --update is a three-way merge, never an overwrite.
 *
 * Nothing is written without --apply. A real file in the way is skipped unless
 * --force, which renames it to a timestamped backup first. Only paths this repo
 * owns are ever touched.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const vendor = require('./vendor.js');
const {
  destFor, rewriteGuidePaths, backupPath, readManifest, writeManifest, writeBaseline,
  updatePlan, applyUpdate, orphanedBaselines, adoptPlan, applyAdopt, projectExtras,
} = vendor;

const REPO = __dirname;
const PAYLOAD = vendor.PAYLOAD_DIRS;

/**
 * Files to install, as {src, rel} pairs relative to the destination root.
 * Walks subdirectories, because a skill is a directory (skills/<name>/SKILL.md
 * plus whatever it ships); each file is installed on its own.
 */
function payload(repo = REPO) {
  const out = [];
  const walk = (abs, rel) => {
    for (const f of fs.readdirSync(abs, { withFileTypes: true })) {
      if (f.name.startsWith('.')) continue;
      const a = path.join(abs, f.name);
      const r = path.join(rel, f.name);
      if (f.isDirectory()) walk(a, r);
      else out.push({ src: a, rel: r });
    }
  };
  for (const dir of PAYLOAD) {
    const abs = path.join(repo, dir);
    if (fs.existsSync(abs)) walk(abs, dir);
  }
  const claudeMd = path.join(repo, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) out.push({ src: claudeMd, rel: 'CLAUDE.md' });
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * A real file in the way is a conflict in both modes: a first install must not
 * eat a project's own CLAUDE.md. Re-installing over vendored copies is what
 * --update is for; --force is the blunt way, and it backs up first.
 */
function classify(src, dest, mode) {
  let st;
  try { st = fs.lstatSync(dest); } catch { return 'create'; }
  if (mode === 'project') return 'conflict';
  if (st.isSymbolicLink()) {
    let target;
    try { target = fs.readlinkSync(dest); } catch { return 'relink'; }
    return path.resolve(path.dirname(dest), target) === path.resolve(src)
      ? 'already-linked' : 'relink';
  }
  return 'conflict';
}

function plan(items, mode, root) {
  return items.map((i) => {
    const dest = destFor(i, mode, root);
    return { ...i, dest, action: classify(i.src, dest, mode) };
  });
}

function apply(entries, { mode, force, log = console.log }) {
  let written = 0, skipped = 0;
  for (const e of entries) {
    if (e.action === 'already-linked') { skipped += 1; continue; }
    if (e.action === 'conflict' && !force) {
      log(`  SKIP   ${e.rel} — real file present; --force replaces it (backed up first)`);
      skipped += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(e.dest), { recursive: true });
    if (e.action === 'conflict') {
      const b = backupPath(e.dest);
      fs.renameSync(e.dest, b);
      log(`  BACKUP ${e.rel} -> ${path.basename(b)}`);
    } else if (e.action === 'relink') {
      try { fs.unlinkSync(e.dest); } catch { /* not there yet */ }
    }
    if (mode === 'global') {
      fs.symlinkSync(e.src, e.dest);
    } else {
      fs.writeFileSync(e.dest, rewriteGuidePaths(fs.readFileSync(e.src, 'utf8'), mode));
    }
    log(`  ${mode === 'global' ? 'LINK  ' : 'COPY  '} ${e.rel}`);
    written += 1;
  }
  return { written, skipped };
}

/**
 * A project install is a copy plus its provenance: the baseline of what was
 * written, so a later --update has a common ancestor to merge against. Only
 * files actually written get a baseline — a skipped conflict has none, and
 * --update will say so rather than guess.
 */
function installProject(root, entries, { force, repo = REPO, log = console.log }) {
  const result = apply(entries, { mode: 'project', force, log });
  for (const e of entries) {
    if (e.action === 'conflict' && !force) continue;
    writeBaseline(root, e.rel, fs.readFileSync(e.dest, 'utf8'));
  }
  writeManifest(root, repo, { mode: 'project' });
  return result;
}

function usage() {
  console.log(`Usage:
  node install.js --global [--apply] [--force]
  node install.js --project <dir> [--apply] [--force]
  node install.js --update  <dir> [--apply]
  node install.js --adopt   <dir> [--apply]

  --global        symlink into ~/.claude, applying to every project
  --project DIR   copy into DIR/.claude, with a baseline so it can be updated
  --update DIR    three-way merge upstream changes into a vendored project
  --adopt DIR     vendor a project that predates the baseline, reconstructing
                  each file's ancestor from this repo's history
  --apply         actually write; omit for a dry run
  --force         replace real files, backing them up first`);
}

function reportUpdate(entries, root, items) {
  for (const e of entries) {
    const note = e.action === 'conflict' ? ` (${e.conflicts} conflict(s))` : '';
    console.log(`  ${e.action.padEnd(12)} ${e.rel}${note}`);
  }
  for (const rel of orphanedBaselines(root, items)) {
    console.log(`  ${'dropped'.padEnd(12)} ${rel} — upstream no longer ships this; left in place`);
  }
}

function reportAdopt(entries, root, repo, items) {
  console.log(`  action    ${'file'.padEnd(38)} ${'base found'.padEnd(40)} Δlines  merge`);
  for (const e of entries) {
    const base = e.base ? `${e.base.commit}:${e.base.path}` : '—';
    const d = e.base ? String(e.base.distance) : '—';
    const merge = e.action === 'merge' ? (e.conflicts ? `${e.conflicts} conflict(s)` : 'clean') : '—';
    const warn = e.weak
      ? `  ** weak base (${(e.divergence * 100).toFixed(0)}% of the file differs) — check before applying **`
      : '';
    console.log(`  ${e.action.padEnd(9)} ${e.rel.padEnd(38)} ${base.padEnd(40)} ${d.padEnd(6)} ${merge}${warn}`);
    if (e.legacy) console.log(`  ${' '.repeat(9)} ↳ from ${path.relative(root, e.oursPath)} (left in place; delete once you are satisfied)`);
  }
  const extras = projectExtras(root, repo, items);
  if (!extras.length) return;
  console.log('\nProject files upstream does not ship (never touched by adopt):');
  for (const x of extras) {
    const why = x.kind === 'stale' ? `identical to ${x.base.commit}:${x.base.path} — a copy of ours, safe to delete`
      : x.kind === 'edited-fork' ? `forked from ${x.base.commit}:${x.base.path}, ${x.base.distance} line(s) changed here`
        : 'no ancestor here — the project wrote it, keep it';
    console.log(`  ${x.kind.padEnd(12)} ${x.rel.padEnd(38)} ${why}`);
  }
}

function main(argv = process.argv.slice(2)) {
  const doApply = argv.includes('--apply');
  const force = argv.includes('--force');
  const dirArg = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1];
  };
  const modes = [
    ['global', argv.includes('--global') ? true : null],
    ['project', dirArg('--project')],
    ['update', dirArg('--update')],
    ['adopt', dirArg('--adopt')],
  ].filter(([, v]) => v);

  if (modes.length !== 1) { usage(); return 1; }
  const [mode, value] = modes[0];
  const root = mode === 'global' ? path.join(os.homedir(), '.claude') : path.resolve(value);

  if (mode !== 'global' && !fs.existsSync(root)) {
    console.error(`No such directory: ${root}`);
    return 1;
  }

  const items = payload();

  if (mode === 'update' || mode === 'adopt') {
    const manifest = readManifest(root);
    if (mode === 'update' && !manifest) {
      console.error(`${root} has no ${vendor.MANIFEST_REL}. Use --project for a fresh install, ` +
                    'or --adopt to bring an existing config in.');
      return 1;
    }
    if (mode === 'adopt' && manifest) {
      console.error(`${root} is already vendored (installed from ${manifest.sourceCommit}). Use --update.`);
      return 1;
    }
    const entries = mode === 'update' ? updatePlan(root, items) : adoptPlan(root, REPO, items);
    console.log(`${doApply ? 'Applying' : 'Dry run —'} ${mode} of ${entries.length} item(s) in ${root}\n`);
    if (!doApply) {
      if (mode === 'update') reportUpdate(entries, root, items);
      else reportAdopt(entries, root, REPO, items);
      console.log('\nRe-run with --apply to write. Nothing has been changed.');
      return 0;
    }
    const counts = mode === 'update'
      ? applyUpdate(root, entries, {})
      : applyAdopt(root, REPO, entries, { force });
    writeManifest(root, REPO, { mode: 'project', via: mode });
    const conflicted = entries.filter((e) => e.conflicts).length;
    console.log(`\n${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    if (conflicted) {
      console.log(`${conflicted} file(s) contain conflict markers. Resolve them before trusting this config.`);
    }
    return 0;
  }

  const entries = plan(items, mode, root);
  console.log(`${doApply ? 'Installing' : 'Dry run —'} ${entries.length} item(s) ` +
              `into ${root}${mode === 'project' ? '/.claude' : ''} [${mode}]\n`);

  if (!doApply) {
    for (const e of entries) console.log(`  ${e.action.padEnd(14)} ${e.rel}`);
    console.log('\nRe-run with --apply to write.');
    const c = entries.filter((e) => e.action === 'conflict').length;
    if (c) console.log(`${c} real file(s) in the way; --force replaces them after backup.`);
    return 0;
  }

  const { written, skipped } = mode === 'project'
    ? installProject(root, entries, { force })
    : apply(entries, { mode, force });
  console.log(`\n${mode === 'global' ? 'Linked' : 'Copied'} ${written}, skipped ${skipped}.`);
  if (mode === 'global') {
    console.log('Merge the PostToolUse block from settings.example.json into ~/.claude/settings.json.');
  } else {
    console.log(`Merge the PostToolUse block from settings.example.json into ${root}/.claude/settings.json,`);
    console.log('changing $HOME/.claude/hooks to $CLAUDE_PROJECT_DIR/.claude/hooks.');
  }
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  payload, destFor, rewriteGuidePaths, classify, plan, apply, installProject, backupPath, main,
};
