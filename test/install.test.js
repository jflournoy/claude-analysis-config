const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { payload, destFor, rewriteGuidePaths, classify, plan, apply } =
  require('../install.js');

let tmp, repo, home, proj;
const mk = (p, body = 'x') => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
};
const quiet = () => {};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-install-'));
  repo = path.join(tmp, 'repo');
  home = path.join(tmp, 'home', '.claude');
  proj = path.join(tmp, 'proj');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(proj, { recursive: true });
  mk(path.join(repo, 'agents', 'alpha.md'), '---\nname: alpha\n---\n');
  mk(path.join(repo, 'commands', 'go.md'), 'go');
  mk(path.join(repo, 'hooks', 'h.js'), '// hook');
  mk(path.join(repo, 'guides', 'voice.md'), 'craft');
  mk(path.join(repo, 'CLAUDE.md'), 'See [voice](~/.claude/guides/voice.md) for prose.\n');
  mk(path.join(repo, 'README.md'), 'not installed');
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('installer', () => {
  describe('payload', () => {
    it('installs agents, commands, hooks, guides and CLAUDE.md', () => {
      const rels = payload(repo).map((p) => p.rel).sort();
      assert.deepStrictEqual(rels, [
        'CLAUDE.md', 'agents/alpha.md', 'commands/go.md', 'guides/voice.md', 'hooks/h.js',
      ]);
    });
    it('leaves README and other repo files behind', () => {
      assert.ok(!payload(repo).some((p) => p.rel === 'README.md'));
    });
  });

  describe('destFor', () => {
    it('global puts everything under ~/.claude', () => {
      assert.strictEqual(destFor({ rel: 'agents/a.md' }, 'global', home),
        path.join(home, 'agents/a.md'));
      assert.strictEqual(destFor({ rel: 'CLAUDE.md' }, 'global', home),
        path.join(home, 'CLAUDE.md'));
    });
    it('project nests under .claude but keeps CLAUDE.md at the project root', () => {
      // Claude Code reads a project's CLAUDE.md from the root, not from .claude/.
      assert.strictEqual(destFor({ rel: 'agents/a.md' }, 'project', proj),
        path.join(proj, '.claude/agents/a.md'));
      assert.strictEqual(destFor({ rel: 'CLAUDE.md' }, 'project', proj),
        path.join(proj, 'CLAUDE.md'));
    });
  });

  describe('rewriteLegacyLinks', () => {
    const { rewriteLegacyLinks } = require('../vendor.js');
    it('rewrites a legacy link to a guide this repo ships', () => {
      assert.strictEqual(rewriteLegacyLinks('see CLAUDE_tdd.md'), 'see .claude/guides/tdd.md');
      assert.strictEqual(rewriteLegacyLinks('see CLAUDE_r-devel.md'),
        'see .claude/guides/r-development.md');
    });
    it('leaves a project\'s own CLAUDE_<name>.md alone', () => {
      const s = 'see CLAUDE_spec.md and CLAUDE_project-spec.md';
      assert.strictEqual(rewriteLegacyLinks(s), s);
    });
  });

  describe('rewriteGuidePaths', () => {
    it('rewrites absolute guide links for a project install', () => {
      assert.strictEqual(
        rewriteGuidePaths('see ~/.claude/guides/voice.md now', 'project'),
        'see .claude/guides/voice.md now');
    });
    it('leaves global links alone', () => {
      const s = 'see ~/.claude/guides/voice.md now';
      assert.strictEqual(rewriteGuidePaths(s, 'global'), s);
    });
    it('rewrites the link to CLAUDE.md itself, which a project keeps at its root', () => {
      assert.strictEqual(
        rewriteGuidePaths('Read `~/.claude/CLAUDE.md` first', 'project'),
        'Read `CLAUDE.md` first');
    });
    it('leaves ~/.claude paths that are not payload alone', () => {
      const s = 'transcripts under ~/.claude/projects/';
      assert.strictEqual(rewriteGuidePaths(s, 'project'), s);
    });
  });

  describe('global install', () => {
    it('symlinks, so edits in the repo take effect immediately', () => {
      apply(plan(payload(repo), 'global', home), { mode: 'global', force: false, log: quiet });
      const dest = path.join(home, 'agents/alpha.md');
      assert.ok(fs.lstatSync(dest).isSymbolicLink());
      fs.writeFileSync(path.join(repo, 'agents', 'alpha.md'), 'EDITED');
      assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'EDITED');
    });
    it('is idempotent', () => {
      apply(plan(payload(repo), 'global', home), { mode: 'global', force: false, log: quiet });
      const second = apply(plan(payload(repo), 'global', home),
        { mode: 'global', force: false, log: quiet });
      assert.strictEqual(second.written, 0);
    });
    it('refuses to clobber a real file without --force', () => {
      const dest = path.join(home, 'CLAUDE.md');
      mk(dest, 'precious');
      apply(plan(payload(repo), 'global', home), { mode: 'global', force: false, log: quiet });
      assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'precious');
    });
    it('backs up before replacing with --force', () => {
      const dest = path.join(home, 'CLAUDE.md');
      mk(dest, 'precious');
      apply(plan(payload(repo), 'global', home), { mode: 'global', force: true, log: quiet });
      const b = fs.readdirSync(home).filter((f) => f.startsWith('CLAUDE.md.backup-'));
      assert.strictEqual(b.length, 1);
      assert.strictEqual(fs.readFileSync(path.join(home, b[0]), 'utf8'), 'precious');
    });
    it('leaves unrelated files in ~/.claude alone', () => {
      mk(path.join(home, 'settings.json'), '{"keep":true}');
      mk(path.join(home, 'projects', 'x.jsonl'), 'transcript');
      apply(plan(payload(repo), 'global', home), { mode: 'global', force: true, log: quiet });
      assert.strictEqual(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'), '{"keep":true}');
      assert.strictEqual(fs.readFileSync(path.join(home, 'projects', 'x.jsonl'), 'utf8'), 'transcript');
    });
  });

  describe('project install', () => {
    it('copies rather than links, so the project is self-contained', () => {
      apply(plan(payload(repo), 'project', proj), { mode: 'project', force: false, log: quiet });
      const dest = path.join(proj, '.claude/agents/alpha.md');
      assert.ok(!fs.lstatSync(dest).isSymbolicLink(), 'must be a real file, not a link');
      fs.writeFileSync(path.join(repo, 'agents', 'alpha.md'), 'EDITED');
      assert.notStrictEqual(fs.readFileSync(dest, 'utf8'), 'EDITED');
    });
    it('rewrites guide links so they resolve inside the project', () => {
      apply(plan(payload(repo), 'project', proj), { mode: 'project', force: false, log: quiet });
      const md = fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8');
      assert.match(md, /\.claude\/guides\/voice\.md/);
      assert.ok(!md.includes('~/.claude/guides/'), 'global link must not survive');
      assert.ok(fs.existsSync(path.join(proj, '.claude/guides/voice.md')),
        'the guide the rewritten link points at must exist');
    });
    it('puts CLAUDE.md at the project root, not inside .claude', () => {
      apply(plan(payload(repo), 'project', proj), { mode: 'project', force: false, log: quiet });
      assert.ok(fs.existsSync(path.join(proj, 'CLAUDE.md')));
      assert.ok(!fs.existsSync(path.join(proj, '.claude', 'CLAUDE.md')));
    });
    it('does not touch the project outside .claude and CLAUDE.md', () => {
      mk(path.join(proj, 'src', 'main.R'), 'f <- function() 1');
      apply(plan(payload(repo), 'project', proj), { mode: 'project', force: false, log: quiet });
      assert.strictEqual(fs.readFileSync(path.join(proj, 'src', 'main.R'), 'utf8'),
        'f <- function() 1');
    });
  });

  describe('classify', () => {
    it('reports create when nothing is there', () => {
      assert.strictEqual(classify(path.join(repo, 'CLAUDE.md'),
        path.join(home, 'CLAUDE.md'), 'global'), 'create');
    });
    it('reports conflict for a real file in global mode', () => {
      const dest = path.join(home, 'CLAUDE.md');
      mk(dest, 'real');
      assert.strictEqual(classify(path.join(repo, 'CLAUDE.md'), dest, 'global'), 'conflict');
    });
  });
});
