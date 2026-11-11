const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const LINT = path.join(__dirname, '..', 'guides', 'voice-lint.sh');
const COLUMNS = ['file', 'words', 'bold', 'bullet', 'emdash', 'figref', 'boiler', 'absent',
  'selfj', 'casual', 'brit', 'words_per_emdash'];

const run = (args, opts = {}) => spawnSync('bash', [LINT, ...args], { encoding: 'utf8', ...opts });

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-lint-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

let n = 0;
function total(body, ext = 'qmd') {
  const f = path.join(tmp, `case${n++}.${ext}`);
  fs.writeFileSync(f, body);
  const r = run([f]);
  assert.strictEqual(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.deepStrictEqual(lines[0].trim().split(/\s+/), COLUMNS);
  const row = lines.find((l) => l.startsWith('TOTAL')).trim().split(/\s+/);
  return Object.fromEntries(COLUMNS.map((c, i) => [c, i === 0 ? row[i] : row[i]]));
}

// Each case plants one violation and checks the count moves. A lint that reads zero
// proves nothing until it has been shown to see the construct it counts.
describe('voice-lint: strings a chunk prints reach the page, so they count', () => {
  it('bold emitted by cat()', () => {
    assert.strictEqual(total('```{r}\ncat("**Interpretation:** something")\n```\n').bold, '1');
  });
  it('a boilerplate heading emitted by cat()', () => {
    assert.strictEqual(total('```{r}\ncat("\\n## Key Findings (Overall)\\n\\n")\n```\n').boiler, '1');
  });
  it('an absent-list word in a ggplot title', () => {
    assert.strictEqual(
      total('```{r}\np <- ggplot(d) + labs(title = "Key findings across sites")\n```\n').absent, '1');
  });
  it('a British spelling in a fig-cap', () => {
    assert.strictEqual(
      total('```{r}\n#| fig-cap: "Sites coloured by winning model"\nplot(1)\n```\n').brit, '1');
  });
  it('bold in a kable caption', () => {
    assert.strictEqual(
      total('```{r}\nknitr::kable(d, caption = "**Note:** counts are per run")\n```\n').bold, '1');
  });
});

describe('voice-lint: prose outside chunks', () => {
  it('counts bold in ordinary prose', () => {
    assert.strictEqual(total('Some prose with a **Label:** in it.\n').bold, '1');
  });
  it('sees a phrase that straddles a hard wrap', () => {
    assert.strictEqual(total('You should see that at\na glance in the plot.\n').absent, '1');
  });
  it('counts self-justification words', () => {
    assert.strictEqual(total('We chose this deliberately, which is why it differs.\n').selfj, '2');
  });
  it('reports words per em-dash', () => {
    assert.strictEqual(total('one two three — four five six — seven eight\n').words_per_emdash, '5');
  });
});

describe('voice-lint: what must not count', () => {
  it('code identifiers are not prose', () => {
    assert.strictEqual(total('```{r}\nx <- data.table(a = 1)\nsetnames(x, "a", "b")\n```\n').bold, '0');
  });
  it('REVIEW comments are not prose', () => {
    assert.strictEqual(
      total('<!-- REVIEW: this file emits "Key findings" from a cat() -->\nOrdinary prose here.\n')
        .absent, '0');
  });
  it('multi-line REVIEW comments are not prose', () => {
    assert.strictEqual(
      total('<!-- REVIEW:\na note mentioning **Interpretation:** as deferred work\n-->\nOrdinary prose.\n')
        .bold, '0');
  });
});

describe('voice-lint: fails loudly', () => {
  it('errors with usage when given no files, instead of guessing a default', () => {
    const r = run([]);
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /usage/i);
  });
  it('errors when a named file does not exist', () => {
    const r = run([path.join(tmp, 'no-such-file.qmd')]);
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /no-such-file\.qmd/);
  });
  it('errors on an unknown flag', () => {
    const r = run(['--bogus']);
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /--bogus/);
  });
});

describe('voice-lint --claude: finds the guide beside itself', () => {
  // A fake claude on PATH records what it was sent, so this runs offline.
  function fakeClaude(dir, exitCode) {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'claude'),
      `#!/usr/bin/env bash\ncat > "${dir}/sent.txt"\necho "reads correctly"\nexit ${exitCode}\n`,
      { mode: 0o755 });
    return { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  }
  function layout(name) {
    const root = path.join(tmp, name);
    fs.mkdirSync(path.join(root, 'guides'), { recursive: true });
    fs.copyFileSync(LINT, path.join(root, 'guides', 'voice-lint.sh'));
    const prose = path.join(root, 'p.md');
    fs.writeFileSync(prose, 'Some prose.\n');
    return { root, script: path.join(root, 'guides', 'voice-lint.sh'), prose };
  }

  it('sends voice.md from its own directory to the model', () => {
    const { root, script, prose } = layout('withguide');
    fs.writeFileSync(path.join(root, 'guides', 'voice.md'), 'GUIDE-SENTINEL\n');
    const r = spawnSync('bash', [script, '--claude', prose],
      { encoding: 'utf8', env: fakeClaude(root, 0) });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(fs.readFileSync(path.join(root, 'sent.txt'), 'utf8'), /GUIDE-SENTINEL/);
  });
  it('errors, naming the path, when voice.md is not beside it', () => {
    const { root, script, prose } = layout('noguide');
    const r = spawnSync('bash', [script, '--claude', prose],
      { encoding: 'utf8', env: fakeClaude(root, 0) });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /voice\.md/);
  });
  it('exits non-zero when the model call fails', () => {
    const { root, script, prose } = layout('callfails');
    fs.writeFileSync(path.join(root, 'guides', 'voice.md'), 'guide\n');
    const r = spawnSync('bash', [script, '--claude', prose],
      { encoding: 'utf8', env: fakeClaude(root, 3) });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /claude/);
  });
});
