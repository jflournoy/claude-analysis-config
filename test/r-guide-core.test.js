const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  coreOf, replaceCore, sameCore, repoHome, defaultSibling, main, BEGIN, END, GUIDE_REL,
} = require('../sync-r-guide.js');

const REPO = path.join(__dirname, '..');
const framed = (core, extras = '\n## Extras\n\nlocal\n') => `${BEGIN}\n${core}\n${END}${extras}`;

describe('coreOf and replaceCore', () => {
  it('returns the text between the markers', () => {
    assert.strictEqual(coreOf(framed('# R\n\nbody')).trim(), '# R\n\nbody');
  });

  it('refuses a guide with missing or repeated markers', () => {
    assert.throws(() => coreOf('no markers'), /exactly one/);
    assert.throws(() => coreOf(`${BEGIN}\n${BEGIN}\n${END}`), /exactly one/);
    assert.throws(() => coreOf(`${END}\n${BEGIN}`), /comes before/);
  });

  it('replaces only the core and keeps the extras byte for byte', () => {
    const out = replaceCore(framed('old core'), 'new core\n\n');
    assert.strictEqual(out, framed('new core'));
  });

  it('compares cores ignoring framing whitespace only', () => {
    assert.ok(sameCore('a\n', '\na'));
    assert.ok(!sameCore('a', 'a b'));
  });
});

describe('main', () => {
  let tmp;
  const quiet = () => {};
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-rcore-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  const setup = (guideCore, siblingCore) => {
    const guide = path.join(tmp, GUIDE_REL);
    fs.mkdirSync(path.dirname(guide), { recursive: true });
    fs.writeFileSync(guide, framed(guideCore));
    const sibling = path.join(tmp, 'core.md');
    fs.writeFileSync(sibling, siblingCore);
    return { guide, sibling };
  };

  it('reports a match and writes nothing', () => {
    const { guide, sibling } = setup('same', 'same\n');
    const before = fs.readFileSync(guide, 'utf8');
    assert.strictEqual(main(['--check', sibling], { root: tmp, log: quiet }), 0);
    assert.strictEqual(fs.readFileSync(guide, 'utf8'), before);
  });

  it('--check exits 1 on a difference and leaves the guide alone', () => {
    const { guide, sibling } = setup('ours', 'theirs\n');
    assert.strictEqual(main(['--check', sibling], { root: tmp, log: quiet }), 1);
    assert.strictEqual(coreOf(fs.readFileSync(guide, 'utf8')).trim(), 'ours');
  });

  it('a plain run takes the sibling core and keeps the extras', () => {
    const { guide, sibling } = setup('ours', 'theirs\n');
    assert.strictEqual(main([sibling], { root: tmp, log: quiet }), 0);
    const after = fs.readFileSync(guide, 'utf8');
    assert.strictEqual(coreOf(after).trim(), 'theirs');
    assert.ok(after.endsWith('\n## Extras\n\nlocal\n'));
  });

  it('a missing sibling is an error, not a no-op', () => {
    setup('ours', 'theirs');
    assert.throws(() => main([path.join(tmp, 'absent.md')], { root: tmp, log: quiet }),
      /canonical core not found/);
  });

  it('resolves the default sibling from the main checkout, not a worktree', () => {
    assert.strictEqual(repoHome(tmp), tmp, 'outside git, the root is its own home');
    assert.ok(fs.existsSync(path.join(repoHome(REPO), '.git')), 'inside git, the home holds .git');
    assert.strictEqual(path.basename(path.dirname(defaultSibling(REPO))), 'modern-r-dev');
  });
});

describe('the shipped guide', () => {
  const guide = fs.readFileSync(path.join(REPO, GUIDE_REL), 'utf8');

  it('has exactly one core region and it starts with the guide title', () => {
    const core = coreOf(guide).trim();
    assert.ok(core.length > 1000, 'core region is not empty');
    assert.match(core, /^<!-- Shared core of the R guide/);
    assert.ok(core.includes('\n# R Development\n'));
  });

  it('keeps the extras outside the core', () => {
    const extras = guide.slice(guide.indexOf(END));
    assert.ok(extras.includes('## Bayesian models'));
    assert.ok(!coreOf(guide).includes('## Bayesian models'));
  });

  // Cross-repository: runs only where the sibling checkout exists. The skip is loud and
  // names the path it looked for; it never passes silently.
  it('matches the canonical core in the sibling checkout, when present', (t) => {
    const sibling = defaultSibling(REPO);
    if (!fs.existsSync(sibling)) {
      t.skip(`sibling checkout not found at ${sibling}; run node sync-r-guide.js --check where it exists`);
      return;
    }
    assert.ok(sameCore(coreOf(guide), fs.readFileSync(sibling, 'utf8')),
      `core differs from ${sibling}; run: node sync-r-guide.js`);
  });
});
