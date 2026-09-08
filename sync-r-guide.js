#!/usr/bin/env node
/**
 * The R guide has one shared core, kept in a sibling repository and vendored here verbatim.
 *
 *   guides/r-development.md  =  <!-- r-core: begin -->  core  <!-- r-core: end -->  + extras
 *
 * The canonical core is CLAUDE_r-devel.md in modern-base-r-dev. Everything outside the
 * markers is this config's own (brms, running R, Quarto). Nothing here decides which side
 * is right: --check reports a difference, and a plain run copies the sibling's core in.
 *
 *   node sync-r-guide.js [--check] [path/to/CLAUDE_r-devel.md]
 *
 * The default path is ../modern-r-dev/CLAUDE_r-devel.md, relative to this repo's main
 * checkout, so it resolves the same from a git worktree under .claude/worktrees/ (the
 * checkout is named modern-r-dev; its GitHub remote is modern-base-r-dev). A missing
 * sibling is an error, not a silent no-op.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GUIDE_REL = path.join('guides', 'r-development.md');
const BEGIN = '<!-- r-core: begin -->';
const END = '<!-- r-core: end -->';
const DEFAULT_SIBLING = path.join('..', 'modern-r-dev', 'CLAUDE_r-devel.md');

/** The text between the markers, or a thrown error if they are missing or repeated. */
function coreOf(text) {
  const begins = text.split(BEGIN).length - 1;
  const ends = text.split(END).length - 1;
  if (begins !== 1 || ends !== 1) {
    throw new Error(`expected exactly one ${BEGIN} and one ${END}; found ${begins} and ${ends}`);
  }
  const start = text.indexOf(BEGIN) + BEGIN.length;
  const stop = text.indexOf(END);
  if (stop < start) throw new Error(`${END} comes before ${BEGIN}`);
  return text.slice(start, stop);
}

/** The guide with its core replaced; the core is framed by single newlines. */
function replaceCore(text, core) {
  coreOf(text);
  const before = text.slice(0, text.indexOf(BEGIN) + BEGIN.length);
  const after = text.slice(text.indexOf(END));
  return `${before}\n${core.replace(/\s+$/, '')}\n${after}`;
}

/** Whitespace at the ends is framing, not content. */
function sameCore(a, b) { return a.trim() === b.trim(); }

/**
 * The main checkout that owns `root`: from a git worktree that is the directory holding
 * the shared .git, so "../modern-r-dev" means the same place everywhere. Outside git it is
 * `root` itself.
 */
function repoHome(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
    { encoding: 'utf8' });
  if (r.status !== 0) return root;
  return path.dirname(r.stdout.trim());
}

function defaultSibling(root) { return path.resolve(repoHome(root), DEFAULT_SIBLING); }

function main(argv, { root = __dirname, log = console.log } = {}) {
  const check = argv.includes('--check');
  const positional = argv.filter((a) => a !== '--check');
  if (positional.length > 1) throw new Error(`unexpected arguments: ${positional.join(' ')}`);
  const sibling = positional[0] ? path.resolve(root, positional[0]) : defaultSibling(root);
  const guidePath = path.join(root, GUIDE_REL);
  if (!fs.existsSync(sibling)) throw new Error(`canonical core not found at ${sibling}`);
  if (!fs.existsSync(guidePath)) throw new Error(`guide not found at ${guidePath}`);

  const core = fs.readFileSync(sibling, 'utf8');
  const guide = fs.readFileSync(guidePath, 'utf8');
  if (sameCore(coreOf(guide), core)) {
    log(`${GUIDE_REL}: core matches ${sibling}`);
    return 0;
  }
  if (check) {
    log(`${GUIDE_REL}: core differs from ${sibling}; run node sync-r-guide.js to take it`);
    return 1;
  }
  fs.writeFileSync(guidePath, replaceCore(guide, core));
  log(`${GUIDE_REL}: core replaced from ${sibling}`);
  return 0;
}

module.exports = {
  coreOf, replaceCore, sameCore, repoHome, defaultSibling, main,
  BEGIN, END, GUIDE_REL, DEFAULT_SIBLING,
};

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
