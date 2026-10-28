const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const CHECK = path.join(__dirname, '..', 'skills', 'research-report', 'check-report.js');
const { extractNumbers, checkProvenance, lintApa, lintStakeholder } = require(CHECK);

const SOURCE = `
Linear mixed model fit by REML
Fixed effects:
             Estimate Std. Error       df t value Pr(>|t|)
(Intercept)   3.21456    0.08123 118.0000  39.574  < 2e-16 ***
time_post     0.41872    0.05310 117.2000   7.886 1.67e-12 ***
group_b      -0.12340    0.09001 116.0000  -1.371    0.173
pre_high  45.2
post_high 59.4
`;

const rules = (errs) => errs.map((e) => e.rule).sort();
const ruleSet = (errs) => [...new Set(rules(errs))];

describe('extractNumbers', () => {
  it('reads decimals, negatives, unicode minus and scientific notation', () => {
    const v = extractNumbers('b = -0.12, c = −1.5, p = 1.67e-12, n = 120, r = .34')
      .map((n) => n.value);
    assert.deepStrictEqual(v, [-0.12, -1.5, 1.67e-12, 120, 0.34]);
  });
  it('records displayed decimals, which set the rounding tolerance', () => {
    assert.deepStrictEqual(extractNumbers('0.42 and 7 and .05').map((n) => n.decimals), [2, 0, 2]);
  });
  it('ignores digits inside identifiers', () => {
    assert.deepStrictEqual(extractNumbers('pre_conf1 and conf_avg6 and x2y').length, 0);
  });
  it('reads the end of a range as a number, not a negative', () => {
    assert.deepStrictEqual(extractNumbers('1-5').map((n) => n.value), [1, 5]);
  });
});

describe('checkProvenance', () => {
  it('traces a value rounded from the source', () => {
    const r = checkProvenance('*b* = 0.42, *SE* = 0.05, *t*(117.20) = 7.89', SOURCE);
    assert.deepStrictEqual(r.untraced, []);
  });
  it('flags a number the source does not contain', () => {
    const r = checkProvenance('*b* = 0.47', SOURCE);
    assert.deepStrictEqual(r.untraced.map((u) => u.raw), ['0.47']);
  });
  it('flags a transposed digit, the copying error this exists to catch', () => {
    const r = checkProvenance('*t* = 7.98', SOURCE);
    assert.deepStrictEqual(r.untraced.map((u) => u.raw), ['7.98']);
  });
  it('flags an explicit sign that contradicts the source', () => {
    const r = checkProvenance('*b* = -0.42', SOURCE);
    assert.deepStrictEqual(r.untraced.map((u) => u.raw), ['-0.42']);
  });
  it('accepts an unsigned magnitude of a negative estimate, and says so', () => {
    const r = checkProvenance('Group B scored 0.12 points lower', SOURCE);
    assert.deepStrictEqual(r.untraced, []);
    assert.deepStrictEqual(r.signDropped.map((u) => u.raw), ['0.12']);
  });
  it('drops the leading zero without losing the trace', () => {
    assert.deepStrictEqual(checkProvenance('*p* = .17', SOURCE).untraced, []);
  });
  it('skips p thresholds, CI levels, table numbers and list markers', () => {
    const text = '1. *p* < .001, 95% CI\n\nTable 3\n\n*p* < .05';
    assert.deepStrictEqual(checkProvenance(text, SOURCE).untraced, []);
  });
  it('skips a bare threshold in a p column of a table', () => {
    assert.deepStrictEqual(checkProvenance('| Time | 0.42 | < .001 |', SOURCE).untraced, []);
  });
  it('still checks a non-threshold number after <', () => {
    assert.deepStrictEqual(checkProvenance('| Time | < .004 |', SOURCE).untraced.map((u) => u.raw),
      ['.004']);
  });
  it('skips code and comments', () => {
    const text = '`x <- 99.99`\n\n```r\ny <- 12345\n```\n<!-- note 777 -->';
    assert.deepStrictEqual(checkProvenance(text, SOURCE).untraced, []);
  });
  it('traces a derived value by checking its arithmetic', () => {
    const text = 'up 14 points <!-- derived: 14 = 59.4 - 45.2 -->';
    const r = checkProvenance(text, SOURCE);
    assert.deepStrictEqual(r.untraced, []);
    assert.deepStrictEqual(r.errors, []);
    assert.strictEqual(r.derived.length, 1);
  });
  it('rejects a derivation whose arithmetic is wrong', () => {
    const r = checkProvenance('up 16 <!-- derived: 16 = 59.4 - 45.2 -->', SOURCE);
    assert.deepStrictEqual(rules(r.errors), ['derived-mismatch']);
  });
  it('rejects a derivation built on a number the source does not contain', () => {
    const r = checkProvenance('up 15 <!-- derived: 15 = 60 - 45.2 -->', SOURCE);
    assert.deepStrictEqual(rules(r.errors), ['derived-untraced-input']);
  });
  it('accepts a declared context value and lists it so a human sees it', () => {
    const r = checkProvenance('2.47 out of 5 <!-- context: 5 = top of the response scale --> '
      + '<!-- context: 2.47 = scale mean the user gave -->', SOURCE);
    assert.deepStrictEqual(r.untraced, []);
    assert.deepStrictEqual(r.context.map((c) => c.value).sort(), [2.47, 5]);
  });
  it('matches a percentage against a proportion in the source', () => {
    assert.deepStrictEqual(checkProvenance('17% of', 'prop 0.1734').untraced, []);
  });
});

describe('lintApa', () => {
  it('rejects p = 0 in every spelling R produces', () => {
    for (const s of ['*p* = 0', '*p* = 0.000', '*p* = .000']) {
      assert.deepStrictEqual(rules(lintApa(s)), ['p-zero'], s);
    }
  });
  it('rejects scientific-notation p-values', () => {
    assert.deepStrictEqual(rules(lintApa('*p* < 2e-16')), ['p-sci']);
  });
  it('rejects a leading zero on statistics bounded by 1', () => {
    assert.deepStrictEqual(rules(lintApa('*p* = 0.03')), ['leading-zero']);
    assert.deepStrictEqual(rules(lintApa('*r* = 0.34')), ['leading-zero']);
    assert.deepStrictEqual(rules(lintApa('*b* = 0.34, *d* = 0.41')), []);
    assert.deepStrictEqual(rules(lintApa('η²_p = 0.61')), ['leading-zero']);
  });
  it('rejects italic Greek letters', () => {
    assert.deepStrictEqual(rules(lintApa('*β* = .20 and *η²* = .04')), ['greek-italic', 'greek-italic']);
    assert.deepStrictEqual(rules(lintApa('β = .20, η² = .04')), []);
  });
  it('rejects Latin statistic symbols left roman', () => {
    assert.deepStrictEqual(rules(lintApa('t(117) = 7.89, p < .001')), ['latin-roman', 'latin-roman']);
    assert.deepStrictEqual(rules(lintApa('*t*(117) = 7.89, *p* < .001')), []);
  });
  it('rejects significance stars standing in for values', () => {
    assert.deepStrictEqual(rules(lintApa('| time | 0.42*** |')), ['stars']);
    assert.deepStrictEqual(rules(lintApa('| time | **0.42** |')), []);
  });
  it('ignores code', () => {
    assert.deepStrictEqual(lintApa('```\np = 0\n```'), []);
  });
});

describe('lintStakeholder', () => {
  it('passes plain bullets under a heading', () => {
    const s = '# Results\n\n- Confidence significantly increased, from 45% to 59%.\n'
      + '- Scores rose from 2.47 to 2.91 out of 5.\n';
    assert.deepStrictEqual(lintStakeholder(s), []);
  });
  it('rejects prose that is not a bullet', () => {
    assert.deepStrictEqual(rules(lintStakeholder('Confidence rose.\n')), ['not-bullet']);
  });
  it('rejects statistical notation and jargon', () => {
    assert.deepStrictEqual(rules(lintStakeholder('- rose (p = .04)\n')), ['jargon']);
    assert.deepStrictEqual(ruleSet(lintStakeholder('- a large regression coefficient\n')), ['jargon']);
  });
  it('leaves ordinary words that share a stem with jargon alone', () => {
    assert.deepStrictEqual(lintStakeholder('- a moderate rise, across 12 customer interactions\n'), []);
    assert.deepStrictEqual(ruleSet(lintStakeholder('- the interaction term mattered\n')), ['jargon']);
  });
  it('rejects percent change where percentage points are meant', () => {
    assert.deepStrictEqual(rules(lintStakeholder('- 38% higher than before\n')), ['percent-change']);
    assert.deepStrictEqual(lintStakeholder('- 15 percentage points higher\n'), []);
  });
  it('rejects unrounded percentages and off-precision decimals', () => {
    assert.deepStrictEqual(rules(lintStakeholder('- 45.2% agreed\n')), ['pct-decimals']);
    assert.deepStrictEqual(rules(lintStakeholder('- scored 2.5 out of 5\n')), ['decimals']);
  });
});

describe('CLI', () => {
  const run = (files, args) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-check-'));
    for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), body);
    const r = spawnSync(process.execPath, [CHECK, ...args.map((a) => a.replace('@', `${dir}/`))],
      { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });
    return r;
  };
  it('exits 0 on a clean report', () => {
    const r = run({ 'out.txt': SOURCE, 'apa.md': '*b* = 0.42, *p* < .001\n' },
      ['--source', '@out.txt', '--apa', '@apa.md']);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  });
  it('exits 1 and names the untraced number', () => {
    const r = run({ 'out.txt': SOURCE, 'apa.md': '*b* = 0.47\n' },
      ['--source', '@out.txt', '--apa', '@apa.md']);
    assert.strictEqual(r.status, 1);
    assert.match(r.stdout, /0\.47/);
  });
  it('refuses to run without a source, rather than checking nothing', () => {
    const r = run({ 'apa.md': '*b* = 0.47\n' }, ['--apa', '@apa.md']);
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, /--source/);
  });
  it('refuses a missing file by name', () => {
    const r = run({}, ['--source', '@nope.txt', '--apa', '@apa.md']);
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, /nope\.txt/);
  });
});
