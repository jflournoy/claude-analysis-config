#!/usr/bin/env node
/**
 * Install this config either system-wide or into a single project.
 *
 *   node install.js --global              # dry run
 *   node install.js --global --apply      # symlink into ~/.claude
 *   node install.js --project ../my-repo --apply   # copy into <repo>/.claude
 *
 * Global uses symlinks: one source of truth, edits here take effect everywhere.
 * Project uses copies: the project becomes self-contained and can commit its own
 * config, which is what a repo that has to be reproducible from a container needs.
 * Copies drift by design — that is the trade for pinning.
 *
 * Nothing is written without --apply. A real file in the way is skipped unless
 * --force, which renames it to a timestamped backup first. Only paths this repo
 * owns are ever touched.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = __dirname;
const PAYLOAD = ['agents', 'commands', 'hooks', 'guides'];

/** Files to install, as {src, rel} pairs relative to the destination root. */
function payload(repo = REPO) {
  const out = [];
  for (const dir of PAYLOAD) {
    const abs = path.join(repo, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (f.startsWith('.')) continue;
      out.push({ src: path.join(abs, f), rel: path.join(dir, f) });
    }
  }
  const claudeMd = path.join(repo, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) out.push({ src: claudeMd, rel: 'CLAUDE.md' });
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

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
 * Guide links in CLAUDE.md are absolute (~/.claude/guides/...) because a global
 * CLAUDE.md is loaded from arbitrary working directories. A project copy keeps its
 * guides locally, so the links must be rewritten or they point at the global set.
 */
function rewriteGuidePaths(text, mode) {
  if (mode !== 'project') return text;
  return text.split('~/.claude/guides/').join('.claude/guides/');
}

function classify(src, dest, mode) {
  let st;
  try { st = fs.lstatSync(dest); } catch { return 'create'; }
  if (mode === 'project') return 'overwrite';
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

function backupPath(dest) {
  return `${dest}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
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
    } else if (e.action === 'relink' || e.action === 'overwrite') {
      try { fs.unlinkSync(e.dest); } catch { /* not there yet */ }
    }
    if (mode === 'global') {
      fs.symlinkSync(e.src, e.dest);
    } else {
      const body = rewriteGuidePaths(fs.readFileSync(e.src, 'utf8'), mode);
      fs.writeFileSync(e.dest, body);
    }
    log(`  ${mode === 'global' ? 'LINK  ' : 'COPY  '} ${e.rel}`);
    written += 1;
  }
  return { written, skipped };
}

function usage() {
  console.log(`Usage:
  node install.js --global [--apply] [--force]
  node install.js --project <dir> [--apply] [--force]

  --global        symlink into ~/.claude, applying to every project
  --project DIR   copy into DIR/.claude, pinning a self-contained set
  --apply         actually write; omit for a dry run
  --force         replace real files, backing them up first`);
}

function main(argv = process.argv.slice(2)) {
  const doApply = argv.includes('--apply');
  const force = argv.includes('--force');
  const isGlobal = argv.includes('--global');
  const pIdx = argv.indexOf('--project');
  const projDir = pIdx !== -1 ? argv[pIdx + 1] : null;

  if (isGlobal === Boolean(projDir)) { usage(); return 1; }
  const mode = isGlobal ? 'global' : 'project';
  const root = isGlobal ? path.join(os.homedir(), '.claude') : path.resolve(projDir);

  if (mode === 'project' && !fs.existsSync(root)) {
    console.error(`No such directory: ${root}`);
    return 1;
  }

  const entries = plan(payload(), mode, root);
  console.log(`${doApply ? 'Installing' : 'Dry run —'} ${entries.length} item(s) ` +
              `into ${root}${mode === 'project' ? '/.claude' : ''} [${mode}]\n`);

  if (!doApply) {
    for (const e of entries) console.log(`  ${e.action.padEnd(14)} ${e.rel}`);
    console.log('\nRe-run with --apply to write.');
    const c = entries.filter((e) => e.action === 'conflict').length;
    if (c) console.log(`${c} real file(s) in the way; --force replaces them after backup.`);
    return 0;
  }

  const { written, skipped } = apply(entries, { mode, force });
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

module.exports = { payload, destFor, rewriteGuidePaths, classify, plan, apply, backupPath };
