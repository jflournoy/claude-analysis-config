const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseOptions, parseGuide, programOf, findStanc, compileBlock, main, GUIDE_REL,
} = require('../check-stan.js');

const REPO = path.join(__dirname, '..');

let stanc = null;
try { stanc = findStanc(null); } catch { stanc = null; }
const needsStanc = (t) => {
  if (stanc) return true;
  t.skip('stanc not found in --stanc, $STANC, $CMDSTAN, or ~/.cmdstan; compile checks not run');
  return false;
};

describe('parseOptions', () => {
  it('reads skip, in=, with, and error=', () => {
    assert.deepStrictEqual(parseOptions(' skip '), { skip: true, in: null, with: false, error: null });
    assert.deepStrictEqual(parseOptions(' in=model with'),
      { skip: false, in: 'model', with: true, error: null });
    assert.deepStrictEqual(parseOptions(' in=generated quantities with'),
      { skip: false, in: 'generated quantities', with: true, error: null });
    assert.deepStrictEqual(parseOptions(' error="no such thing"'),
      { skip: false, in: null, with: false, error: 'no such thing' });
  });

  it('refuses unknown options and unknown blocks', () => {
    assert.throws(() => parseOptions(' compile'), /unrecognised/);
    assert.throws(() => parseOptions(' in=priors'), /not a Stan block/);
  });
});

const fixture = [
  '## One',
  '',
  '```stan',
  'parameters { real x; }',
  'model { x ~ normal(0, 1); }',
  '```',
  '',
  '### Two',
  '',
  '<!-- stan: in=model with',
  'data { int<lower=0> N; vector[N] y; }',
  'parameters { real mu; }',
  '-->',
  '```stan',
  'y ~ normal(mu, 1);',
  '```',
  '',
  '<!-- stan: skip -->',
  '```stan',
  'y[n] ~ normal(mu[n], sigma);   // one of two alternatives',
  '```',
  '',
  '```r',
  'fit <- mod$sample()',
  '```',
  '',
  '<!-- stan: error="half_normal_lpdf" -->',
  '```stan',
  'parameters { real<lower=0> s; }',
  'model { s ~ half_normal(0, 1); }',
  '```',
];

describe('parseGuide and programOf', () => {
  it('finds stan fences with and without markers and ignores other fences', () => {
    const blocks = parseGuide(fixture);
    assert.strictEqual(blocks.length, 4);
    assert.deepStrictEqual(blocks.map((b) => b.section), ['One', 'Two', 'Two', 'Two']);
    assert.deepStrictEqual(blocks.map((b) => b.line), [3, 14, 19, 28]);
    assert.strictEqual(blocks[1].opts.in, 'model');
    assert.match(blocks[1].prelude, /^data \{/);
    assert.strictEqual(blocks[2].opts.skip, true);
    assert.strictEqual(blocks[3].opts.error, 'half_normal_lpdf');
  });

  it('assembles prelude, wrapper, and snippet in that order', () => {
    const p = programOf(parseGuide(fixture)[1]);
    assert.strictEqual(p, 'data { int<lower=0> N; vector[N] y; }\nparameters { real mu; }\nmodel {\ny ~ normal(mu, 1);\n}\n');
    assert.strictEqual(programOf(parseGuide(fixture)[0]), 'parameters { real x; }\nmodel { x ~ normal(0, 1); }\n');
  });

  it('refuses a marker that does not precede a stan fence, or is malformed', () => {
    assert.throws(() => parseGuide(['<!-- stan: skip -->', 'prose', '```stan', 'x', '```']), /not followed by a fence/);
    assert.throws(() => parseGuide(['<!-- stan: skip -->', '```r', 'x', '```']), /precedes a `r` fence/);
    assert.throws(() => parseGuide(['<!-- stan: with', 'data { int N; }']), /never closed/);
    assert.throws(() => parseGuide(['<!-- stan: skip', 'data { int N; }', '-->', '```stan', 'x', '```']), /prelude given without/);
    assert.throws(() => parseGuide(['<!-- stan: with -->', '```stan', 'x', '```']), /without a prelude/);
    assert.throws(() => parseGuide(['```stan', 'x']), /never closed/);
  });
});

describe('compileBlock', () => {
  it('compiles a program, wraps statements, and honours error=', (t) => {
    if (!needsStanc(t)) return;
    const blocks = parseGuide(fixture);
    assert.strictEqual(compileBlock(blocks[0], stanc).ok, true);
    assert.strictEqual(compileBlock(blocks[1], stanc).ok, true);
    const err = compileBlock(blocks[3], stanc);
    assert.strictEqual(err.ok, true, err.message);
    assert.match(err.message, /fails as documented/);
  });

  it('reports a snippet that does not compile, with stanc\'s message', (t) => {
    if (!needsStanc(t)) return;
    const bad = parseGuide(['```stan', 'model { y ~ normal(0, 1); }', '```'])[0];
    const r = compileBlock(bad, stanc);
    assert.strictEqual(r.ok, false);
    assert.match(r.message, /y/);
  });

  it('an error= block that compiles, or errors differently, is a failure', (t) => {
    if (!needsStanc(t)) return;
    const compiles = parseGuide(['<!-- stan: error="nope" -->', '```stan', 'parameters { real x; }', '```'])[0];
    assert.match(compileBlock(compiles, stanc).message, /expected a compile error/);
    const other = parseGuide(['<!-- stan: error="nope" -->', '```stan', 'model { q ~ normal(0, 1); }', '```'])[0];
    assert.match(compileBlock(other, stanc).message, /does not mention "nope"/);
  });
});

describe('the shipped guide', () => {
  const lines = fs.readFileSync(path.join(REPO, GUIDE_REL), 'utf8').split('\n');

  it('parses, and every stan fence is accounted for', () => {
    const blocks = parseGuide(lines);
    const fences = lines.filter((l) => l === '```stan').length;
    assert.strictEqual(blocks.length, fences);
    assert.ok(blocks.length >= 14, `expected at least 14 stan fences, found ${blocks.length}`);
  });

  it('every stan fence compiles, or fails exactly as documented', (t) => {
    if (!needsStanc(t)) return;
    const out = [];
    const failures = main([], { root: REPO, log: (s) => out.push(s) });
    assert.strictEqual(failures, 0, out.join('\n'));
  });
});
