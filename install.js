#!/usr/bin/env node
/**
 * Install this config system-wide, or vendor it into a single project.
 *
 *   node install.js --global               # dry run
 *   node install.js --global --apply       # symlink into ~/.claude
 *   node install.js --project ../my-repo --apply   # copy into <repo>/.claude
 *   node install.js --update  ../my-repo           # take upstream changes, keeping the project's
 *   node install.js --resolve ../my-repo CLAUDE.md # after hand-porting a file update could not merge
 *
 * Global uses symlinks: one source of truth, edits here take effect everywhere.
 * Project uses copies, plus a baseline of exactly what was copied, so the
 * project can change anything and still take upstream changes later — see
 * vendor.js. --update is a three-way merge, never an overwrite; a file with no
 * baseline yet is adopted from this repo's history, file by file.
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
  updatePlan, applyUpdate, orphanedBaselines, projectExtras, resolvePlan, applyResolve,
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

function usage(log = console.log) {
  log(`Usage:
  node install.js --global [--apply] [--force]
  node install.js --project <dir> [--apply] [--force]
  node install.js --update  <dir> [--apply] [--force]
  node install.js --resolve <dir> <file>... [--apply]

  --global        symlink into ~/.claude, applying to every project
  --project DIR   copy into DIR/.claude, with a baseline so it can be updated
  --update DIR    three-way merge upstream changes into a project. A file with
                  no baseline yet is adopted: its ancestor is reconstructed from
                  this repo's history. One that cannot be merged is left alone,
                  with upstream's copy beside it as <file>.upstream
  --resolve DIR   after porting <file>.upstream into <file> by hand, record it
                  as the baseline so later updates merge normally
  --adopt DIR     old name for --update
  --apply         actually write; omit for a dry run
  --force         replace real files, backing them up first; with --update,
                  merge against a base flagged weak`);
}

function adoptDetail(e) {
  const base = e.base ? `${e.base.commit}:${e.base.path}, ${e.base.distance} line(s) apart` : 'no base found';
  const will = {
    merge: e.conflicts ? `merge, ${e.conflicts} conflict(s)` : 'clean merge',
    sidecar: 'left untouched; upstream written beside it',
    'install-upstream': 'upstream installed; port the old file by hand',
  }[e.outcome];
  const warn = !e.weak ? ''
    : e.outcome === 'merge' ? ` ** weak base (${(e.divergence * 100).toFixed(0)}% differs) — merging anyway, --force **`
      : ` ** weak base (${(e.divergence * 100).toFixed(0)}% of the file differs) — not merged without --force **`;
  return ` [no baseline; ${base}; ${will}]${warn}`;
}

function reportUpdate(entries, root, repo, items, log = console.log) {
  for (const e of entries) {
    let note = '';
    if (e.action === 'conflict') note = ` (${e.conflicts} conflict(s))`;
    if (e.action === 'merge' || e.action === 'no-ancestor') note = adoptDetail(e);
    if (e.action === 'unresolved') {
      note = ` — waiting on --resolve${e.upstreamMoved ? '; upstream has moved since the sidecar was written' : ''}`;
    }
    log(`  ${e.action.padEnd(12)} ${e.rel}${note}`);
    if (e.legacy) log(`  ${' '.repeat(12)} ↳ from ${path.relative(root, e.oursPath)} (left in place; delete once you are satisfied)`);
  }
  for (const rel of orphanedBaselines(root, items)) {
    log(`  ${'dropped'.padEnd(12)} ${rel} — upstream no longer ships this; left in place`);
  }
  for (const e of entries.filter((x) => x.outcome === 'sidecar')) {
    const sidecar = path.relative(root, vendor.sidecarPath(e.dest));
    log(`\n${e.rel}: --apply leaves it untouched and writes ${sidecar}. Port by hand, then run: ` +
        vendor.command('--resolve', root, e.rel, '--apply'));
    if (e.weak) log(`Or merge against the weak base anyway: ${vendor.command('--update', root, '--force', '--apply')}`);
  }
  for (const e of entries.filter((x) => x.action === 'unresolved')) {
    log(`\n${e.rel}: port what you want from ${path.relative(root, e.sidecar)}, then run: ` +
        vendor.command('--resolve', root, e.rel, '--apply'));
  }
  if (!entries.some((e) => e.action === 'merge' || e.action === 'no-ancestor')) return;
  const extras = projectExtras(root, repo, items);
  if (!extras.length) return;
  log('\nProject files upstream does not ship (never touched by update):');
  for (const x of extras) {
    const why = x.kind === 'stale' ? `identical to ${x.base.commit}:${x.base.path} — a copy of ours, safe to delete`
      : x.kind === 'edited-fork' ? `forked from ${x.base.commit}:${x.base.path}, ${x.base.distance} line(s) changed here`
        : 'no ancestor here — the project wrote it, keep it';
    log(`  ${x.kind.padEnd(12)} ${x.rel.padEnd(38)} ${why}`);
  }
}

function runResolve(root, names, { repo, doApply, log, err }) {
  let entries;
  try {
    entries = resolvePlan(root, payload(repo), names);
  } catch (e) {
    err(e.message);
    return 1;
  }
  if (!doApply) {
    for (const e of entries) log(`  resolve      ${e.rel}${e.removed ? ' (removed)' : ''}`);
    log('\nRe-run with --apply to write. Nothing has been changed.');
    return 0;
  }
  applyResolve(root, entries, { log });
  return 0;
}

function runUpdate(root, { repo, doApply, force, log, err }) {
  const items = payload(repo);
  let entries;
  try {
    entries = updatePlan(root, repo, items, { force });
  } catch (e) {
    err(e.message);
    return 1;
  }
  log(`${doApply ? 'Applying' : 'Dry run —'} update of ${entries.length} item(s) in ${root}\n`);
  if (!doApply) {
    reportUpdate(entries, root, repo, items, log);
    log('\nRe-run with --apply to write. Nothing has been changed.');
    return 0;
  }
  const counts = applyUpdate(root, entries, { log });
  writeManifest(root, repo, { mode: 'project', via: 'update' });
  log(`\n${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  const conflicted = entries.filter((e) => e.conflicts && (e.action !== 'merge' || e.outcome === 'merge')).length;
  if (conflicted) log(`${conflicted} file(s) contain conflict markers. Resolve them before trusting this config.`);
  const waiting = entries.filter((e) => e.action === 'unresolved' || e.outcome === 'sidecar').length;
  if (waiting) log(`${waiting} file(s) wait on a hand port and --resolve; each line above names the command.`);
  return 0;
}

function main(argv = process.argv.slice(2), { repo = REPO, log = console.log, err = console.error } = {}) {
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
    ['resolve', dirArg('--resolve')],
  ].filter(([, v]) => v);

  if (modes.length !== 1) { usage(log); return 1; }
  let [mode, value] = modes[0];
  const root = mode === 'global' ? path.join(os.homedir(), '.claude') : path.resolve(value);

  if (mode !== 'global' && !fs.existsSync(root)) {
    err(`No such directory: ${root}`);
    return 1;
  }

  if (mode === 'adopt') {
    err('--adopt is now part of --update, which adopts any file with no baseline. Running --update.');
    mode = 'update';
  }
  if (mode === 'update') return runUpdate(root, { repo, doApply, force, log, err });
  if (mode === 'resolve') {
    const at = argv.indexOf('--resolve') + 2;
    const rest = argv.slice(at);
    const stop = rest.findIndex((a) => a.startsWith('--'));
    return runResolve(root, stop === -1 ? rest : rest.slice(0, stop), { repo, doApply, log, err });
  }

  const items = payload(repo);
  const entries = plan(items, mode, root);
  log(`${doApply ? 'Installing' : 'Dry run —'} ${entries.length} item(s) ` +
              `into ${root}${mode === 'project' ? '/.claude' : ''} [${mode}]\n`);

  if (!doApply) {
    for (const e of entries) log(`  ${e.action.padEnd(14)} ${e.rel}`);
    log('\nRe-run with --apply to write.');
    const c = entries.filter((e) => e.action === 'conflict').length;
    if (c) log(`${c} real file(s) in the way; --force replaces them after backup.`);
    return 0;
  }

  const { written, skipped } = mode === 'project'
    ? installProject(root, entries, { force, repo, log })
    : apply(entries, { mode, force, log });
  log(`\n${mode === 'global' ? 'Linked' : 'Copied'} ${written}, skipped ${skipped}.`);
  if (mode === 'global') {
    log('Merge the PostToolUse block from settings.example.json into ~/.claude/settings.json.');
  } else {
    log(`Merge the PostToolUse block from settings.example.json into ${root}/.claude/settings.json,`);
    log('changing $HOME/.claude/hooks to $CLAUDE_PROJECT_DIR/.claude/hooks.');
  }
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  payload, destFor, rewriteGuidePaths, classify, plan, apply, installProject, backupPath, main,
};
