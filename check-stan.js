#!/usr/bin/env node
/**
 * Every ```stan fence in guides/bayesian-production.md compiles with stanc, so the guide's
 * `[C]` marker is a mechanism rather than a claim.
 *
 *   node check-stan.js [--stanc /path/to/stanc] [guide.md]
 *
 * A fence with no marker is compiled as a complete program. A marker is an HTML comment
 * immediately before the fence; its first line carries options and any further lines are a
 * prelude (declarations the snippet needs) placed before the snippet:
 *
 *   <!-- stan: skip -->                    listed, not compiled
 *   <!-- stan: with                        prelude follows, snippet appended after it
 *   data { int N; vector[N] y; }
 *   -->
 *   <!-- stan: in=model with               snippet is statements; wrap it in `model { }`
 *   data { int N; vector[N] y; }
 *   -->
 *   <!-- stan: error="half_normal_lpdf" -->  must FAIL to compile, with that text in the error
 *
 * stanc is found from --stanc, then $STANC, then $CMDSTAN/bin/stanc, then the newest
 * ~/.cmdstan/cmdstan-*\/bin/stanc. None found is an error, not a skip.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GUIDE_REL = path.join('guides', 'bayesian-production.md');
const BLOCK_ORDER = ['functions', 'data', 'transformed data', 'parameters',
  'transformed parameters', 'model', 'generated quantities'];

/** Options from a marker's first line: skip, in=<block>, with, error="<text>". */
function parseOptions(text) {
  const opts = { skip: false, in: null, with: false, error: null };
  // Block names longest first, so `transformed data` is not read as `data`
  const names = [...BLOCK_ORDER].sort((a, b) => b.length - a.length).join('|');
  const re = new RegExp(`\\s*(skip|with|in=(${names}|[a-z]+)|error="([^"]*)")`, 'gy');
  let m;
  let pos = 0;
  while ((m = re.exec(text)) !== null) {
    pos = re.lastIndex;
    if (m[1] === 'skip') opts.skip = true;
    else if (m[1] === 'with') opts.with = true;
    else if (m[2] !== undefined) opts.in = m[2];
    else opts.error = m[3];
  }
  if (text.slice(pos).trim() !== '') throw new Error(`unrecognised marker options: ${text.trim()}`);
  if (opts.in && !BLOCK_ORDER.includes(opts.in)) throw new Error(`in=${opts.in} is not a Stan block`);
  return opts;
}

/**
 * Blocks in the guide: {section, line, code, opts, prelude}. A marker not followed by a
 * stan fence is an error, and so is a prelude on a marker without `with`.
 */
function parseGuide(lines) {
  const blocks = [];
  let heading = '';
  let marker = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,3} /.test(line)) heading = line.replace(/^#{1,3} /, '');
    if (line.startsWith('<!-- stan:')) {
      if (marker) throw new Error(`line ${i + 1}: marker follows the marker at line ${marker.line} with no fence between`);
      const start = i;
      const body = [line.slice('<!-- stan:'.length)];
      while (!body[body.length - 1].trimEnd().endsWith('-->')) {
        i += 1;
        if (i >= lines.length) throw new Error(`line ${start + 1}: marker is never closed`);
        body.push(lines[i]);
      }
      body[body.length - 1] = body[body.length - 1].trimEnd().slice(0, -'-->'.length);
      const opts = parseOptions(body[0]);
      const prelude = body.slice(1).join('\n').trim();
      if (prelude && !opts.with) throw new Error(`line ${start + 1}: prelude given without \`with\``);
      if (opts.with && !prelude) throw new Error(`line ${start + 1}: \`with\` given without a prelude`);
      marker = { line: start + 1, opts, prelude };
      continue;
    }
    const fence = /^```(\w*)$/.exec(line);
    if (fence) {
      const lang = fence[1];
      const start = i;
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i += 1; }
      if (i >= lines.length) throw new Error(`line ${start + 1}: fence is never closed`);
      if (lang === 'stan') {
        blocks.push({
          section: heading, line: start + 1, code: code.join('\n'),
          opts: marker ? marker.opts : parseOptions(''), prelude: marker ? marker.prelude : '',
        });
      } else if (marker) {
        throw new Error(`line ${start + 1}: the marker at line ${marker.line} precedes a \`${lang}\` fence, not stan`);
      }
      marker = null;
      continue;
    }
    if (marker && line.trim() !== '') throw new Error(`line ${i + 1}: the marker at line ${marker.line} is not followed by a fence`);
  }
  if (marker) throw new Error(`the marker at line ${marker.line} is not followed by a fence`);
  return blocks;
}

/** The program stanc sees: prelude, then the snippet, wrapped in a block if asked. */
function programOf(block) {
  const body = block.opts.in ? `${block.opts.in} {\n${block.code}\n}` : block.code;
  return block.prelude ? `${block.prelude}\n${body}\n` : `${body}\n`;
}

function findStanc(explicit) {
  const candidates = [explicit, process.env.STANC,
    process.env.CMDSTAN && path.join(process.env.CMDSTAN, 'bin', 'stanc')].filter(Boolean);
  const home = path.join(os.homedir(), '.cmdstan');
  if (fs.existsSync(home)) {
    const versions = fs.readdirSync(home).filter((d) => d.startsWith('cmdstan-'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) candidates.push(path.join(home, v, 'bin', 'stanc'));
  }
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error(`stanc not found; tried: ${candidates.join(', ') || '(nothing)'}. Pass --stanc or set STANC or CMDSTAN`);
  return found;
}

function stancVersion(stanc) {
  return spawnSync(stanc, ['--version'], { encoding: 'utf8' }).stdout.trim();
}

/** {ok, message}: ok means the block behaved as its marker says it should. */
function compileBlock(block, stanc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stan-check-'));
  const src = path.join(dir, 'snippet.stan');
  fs.writeFileSync(src, programOf(block));
  const r = spawnSync(stanc, ['--o', path.join(dir, 'snippet.hpp'), src], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const output = `${r.stdout}${r.stderr}`.trim();
  if (block.opts.error !== null) {
    if (r.status === 0) return { ok: false, message: 'expected a compile error, but it compiled' };
    if (!output.includes(block.opts.error)) {
      return { ok: false, message: `compile error does not mention "${block.opts.error}":\n${output}` };
    }
    return { ok: true, message: `fails as documented: ${block.opts.error}` };
  }
  if (r.status !== 0) return { ok: false, message: output };
  return { ok: true, message: '' };
}

function main(argv, { root = __dirname, log = console.log } = {}) {
  let explicit = null;
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--stanc') { explicit = argv[i + 1]; i += 1; } else positional.push(argv[i]);
  }
  if (positional.length > 1) throw new Error(`unexpected arguments: ${positional.join(' ')}`);
  const guide = path.resolve(root, positional[0] || GUIDE_REL);
  if (!fs.existsSync(guide)) throw new Error(`guide not found at ${guide}`);
  const stanc = findStanc(explicit);
  log(`${stancVersion(stanc)} at ${stanc}`);

  const blocks = parseGuide(fs.readFileSync(guide, 'utf8').split('\n'));
  let failures = 0;
  let compiled = 0;
  for (const b of blocks) {
    const label = `${b.section} (line ${b.line})`;
    if (b.opts.skip) { log(`SKIP  ${label}: not compiled`); continue; }
    compiled += 1;
    const r = compileBlock(b, stanc);
    if (r.ok) log(`OK    ${label}${r.message ? `: ${r.message}` : ''}`);
    else { failures += 1; log(`FAIL  ${label}\n      ${r.message.replace(/\n/g, '\n      ')}`); }
  }
  log(`\n${compiled} block(s) compiled, ${failures} failure(s)`);
  return failures;
}

module.exports = {
  parseOptions, parseGuide, programOf, findStanc, stancVersion, compileBlock, main, GUIDE_REL,
};

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2)) > 0 ? 1 : 0;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
