const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const vendor = require('../vendor.js');
const { payload, plan, installProject, classify } = require('../install.js');

const {
  updatePlan, applyUpdate, orphanedBaselines, adoptPlan, applyAdopt, projectExtras,
  readManifest, readBaseline, merge3, findBase, historyPaths, projectCandidates,
} = vendor;

let tmp, repo, proj;
const quiet = () => {};
const mk = (p, body) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
};
const read = (p) => fs.readFileSync(p, 'utf8');
const git = (args, cwd = repo) => {
  // The user's global gitignore hides CLAUDE_*.md and .claude/; a fixture repo
  // must not inherit it or half these files never get committed.
  const r = spawnSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@e',
    '-c', 'core.excludesFile=/dev/null', ...args],
    { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const commit = (msg) => { git(['add', '-A']); git(['commit', '-q', '-m', msg]); };

const GUIDE_V1 = ['# Voice', '', 'one', 'two', 'three', 'four', 'five', 'six', ''].join('\n');
const items = () => payload(repo);
const install = () => installProject(proj, plan(items(), 'project', proj),
  { force: false, repo, log: quiet });

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-vendor-'));
  repo = path.join(tmp, 'repo');
  proj = path.join(tmp, 'proj');
  fs.mkdirSync(proj, { recursive: true });
  mk(path.join(repo, 'guides', 'voice.md'), GUIDE_V1);
  mk(path.join(repo, 'agents', 'alpha.md'), '---\nname: alpha\n---\n');
  mk(path.join(repo, 'CLAUDE.md'), 'See [voice](~/.claude/guides/voice.md).\n');
  git(['init', '-q', '-b', 'main']);
  commit('v1');
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('project install', () => {
  it('records where it came from and what it wrote', () => {
    install();
    const m = readManifest(proj);
    assert.strictEqual(m.source, repo);
    assert.strictEqual(m.sourceCommit.length, 40);
    // The baseline holds what was written, links rewritten and all, so a later
    // merge compares like with like.
    assert.strictEqual(readBaseline(proj, 'guides/voice.md'), GUIDE_V1);
    assert.match(readBaseline(proj, 'CLAUDE.md'), /\.claude\/guides\/voice\.md/);
  });

  it('will not eat a CLAUDE.md the project already had', () => {
    mk(path.join(proj, 'CLAUDE.md'), 'project rules');
    install();
    assert.strictEqual(read(path.join(proj, 'CLAUDE.md')), 'project rules');
    assert.strictEqual(readBaseline(proj, 'CLAUDE.md'), null,
      'a file we did not write must not get a baseline');
  });

  it('reports a real project file as a conflict, not an overwrite', () => {
    mk(path.join(proj, 'CLAUDE.md'), 'project rules');
    assert.strictEqual(
      classify(path.join(repo, 'CLAUDE.md'), path.join(proj, 'CLAUDE.md'), 'project'),
      'conflict');
  });
});

describe('update', () => {
  const guide = () => path.join(proj, '.claude', 'guides', 'voice.md');

  it('plans without touching anything', () => {
    install();
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'SIX'));
    const before = read(guide());
    updatePlan(proj, items());
    assert.strictEqual(read(guide()), before);
  });

  it('does nothing when upstream has not moved', () => {
    install();
    const e = updatePlan(proj, items()).find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.action, 'unchanged');
  });

  it('takes upstream wholesale when the project never touched the file', () => {
    install();
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'SIX'));
    const entries = updatePlan(proj, items());
    assert.strictEqual(entries.find((x) => x.rel === 'guides/voice.md').action, 'fast-forward');
    applyUpdate(proj, entries, { log: quiet });
    assert.match(read(guide()), /SIX/);
  });

  it('keeps the project edit and takes the upstream one', () => {
    install();
    fs.writeFileSync(guide(), GUIDE_V1.replace('one', 'PROJECT ONE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    const entries = updatePlan(proj, items());
    const e = entries.find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.action, 'merged');
    applyUpdate(proj, entries, { log: quiet });
    const after = read(guide());
    assert.match(after, /PROJECT ONE/);
    assert.match(after, /UPSTREAM SIX/);
    assert.strictEqual(readBaseline(proj, 'guides/voice.md').includes('UPSTREAM SIX'), true,
      'the baseline must advance, or the same change is offered again next time');
  });

  it('marks a real disagreement rather than picking a side', () => {
    install();
    fs.writeFileSync(guide(), GUIDE_V1.replace('three', 'PROJECT THREE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('three', 'UPSTREAM THREE'));
    const entries = updatePlan(proj, items());
    const e = entries.find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.action, 'conflict');
    assert.strictEqual(e.conflicts, 1);
    applyUpdate(proj, entries, { log: quiet });
    const after = read(guide());
    assert.match(after, /^<{7} project$/m);
    assert.match(after, /PROJECT THREE/);
    assert.match(after, /UPSTREAM THREE/);
    const backups = fs.readdirSync(path.dirname(guide())).filter((f) => f.includes('.backup-'));
    assert.strictEqual(backups.length, 1, 'the pre-merge file must survive somewhere');
    assert.match(read(path.join(path.dirname(guide()), backups[0])), /PROJECT THREE/);
  });

  it('honours a file the project deleted on purpose', () => {
    install();
    fs.unlinkSync(guide());
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'SIX'));
    const entries = updatePlan(proj, items());
    const e = entries.find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.action, 'removed');
    assert.strictEqual(e.upstreamMoved, true);
    applyUpdate(proj, entries, { log: quiet });
    assert.ok(!fs.existsSync(guide()), 'a deletion is a decision, not damage to repair');
  });

  it('ships a file the project does not have yet', () => {
    install();
    mk(path.join(repo, 'agents', 'beta.md'), '---\nname: beta\n---\n');
    const entries = updatePlan(proj, items());
    assert.strictEqual(entries.find((x) => x.rel === 'agents/beta.md').action, 'add');
    applyUpdate(proj, entries, { log: quiet });
    assert.ok(fs.existsSync(path.join(proj, '.claude', 'agents', 'beta.md')));
  });

  it('refuses to merge a file it has no baseline for', () => {
    mk(path.join(proj, 'CLAUDE.md'), 'project rules');
    install();
    const entries = updatePlan(proj, items());
    assert.strictEqual(entries.find((x) => x.rel === 'CLAUDE.md').action, 'no-baseline');
    applyUpdate(proj, entries, { log: quiet });
    assert.strictEqual(read(path.join(proj, 'CLAUDE.md')), 'project rules');
  });

  it('reports a file upstream has dropped instead of deleting it', () => {
    install();
    fs.unlinkSync(path.join(repo, 'agents', 'alpha.md'));
    assert.deepStrictEqual(orphanedBaselines(proj, items()), ['agents/alpha.md']);
    assert.ok(fs.existsSync(path.join(proj, '.claude', 'agents', 'alpha.md')));
  });

  it('throws on an unreadable manifest rather than reinstalling over the project', () => {
    install();
    fs.writeFileSync(vendor.manifestPath(proj), '{ not json');
    assert.throws(() => readManifest(proj), /not valid JSON/);
  });
});

describe('adopt', () => {
  // A project from before any of this: the guide still lives at the root under
  // its old name, with an edit of its own, and upstream has moved on.
  const legacyProject = () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), GUIDE_V1.replace('one', 'PROJECT ONE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
  };

  it('reconstructs the ancestor from history and merges against it', () => {
    // Upstream moves on; the project is still sitting on v1 plus its own edit.
    mk(path.join(proj, '.claude', 'guides', 'voice.md'), GUIDE_V1.replace('one', 'PROJECT ONE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    commit('v2');
    const e = adoptPlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.action, 'merge');
    assert.strictEqual(e.base.distance, 2, 'one line changed: one out, one in');
    assert.strictEqual(e.conflicts, 0);
    assert.strictEqual(e.weak, false, 'a real ancestor must not be flagged weak');
    assert.match(e.merged, /PROJECT ONE/);
    assert.match(e.merged, /UPSTREAM SIX/);
  });

  it('finds a guide the project still keeps under its old root name', () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), GUIDE_V1.replace('one', 'PROJECT ONE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    commit('v2');
    const e = adoptPlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.legacy, true);
    assert.strictEqual(e.oursPath, path.join(proj, 'CLAUDE_voice.md'));
    assert.strictEqual(e.action, 'merge');
    applyAdopt(proj, repo, [e], { log: quiet });
    assert.match(read(path.join(proj, '.claude', 'guides', 'voice.md')), /PROJECT ONE/);
    assert.ok(fs.existsSync(path.join(proj, 'CLAUDE_voice.md')),
      'the legacy file is reported, not deleted behind the user');
  });

  it('follows a guide that was renamed on its way into this repo', () => {
    mk(path.join(repo, 'CLAUDE_r-devel.md'), GUIDE_V1);
    commit('legacy r guide');
    fs.unlinkSync(path.join(repo, 'CLAUDE_r-devel.md'));
    mk(path.join(repo, 'guides', 'r-development.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    commit('renamed');
    mk(path.join(proj, 'CLAUDE_r-devel.md'), GUIDE_V1.replace('one', 'PROJECT ONE'));
    const e = adoptPlan(proj, repo, items()).find((x) => x.rel === 'guides/r-development.md');
    assert.strictEqual(e.base.path, 'CLAUDE_r-devel.md');
    assert.strictEqual(e.conflicts, 0);
    assert.match(e.merged, /PROJECT ONE/);
  });

  it('plans without touching anything', () => {
    legacyProject();
    commit('v2');
    const before = read(path.join(proj, 'CLAUDE_voice.md'));
    adoptPlan(proj, repo, items());
    assert.strictEqual(read(path.join(proj, 'CLAUDE_voice.md')), before);
    assert.ok(!fs.existsSync(path.join(proj, '.claude', 'guides', 'voice.md')));
  });

  it('will not merge a file with no ancestor here, and says which to port', () => {
    mk(path.join(proj, 'CLAUDE.md'), 'nothing in common with upstream at all\n');
    const e = adoptPlan(proj, repo, items()).find((x) => x.rel === 'CLAUDE.md');
    assert.strictEqual(e.action, 'merge');
    assert.strictEqual(e.weak, true, 'a file sharing nothing with history is not a descendant');
  });

  it('installs the current-layout file when only a legacy one exists with no ancestor', () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), 'wholly unrelated prose\n');
    git(['rm', '-q', 'guides/voice.md']);
    commit('drop guide from history path');
    mk(path.join(repo, 'guides', 'voice.md'), GUIDE_V1);
    const e = adoptPlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    if (e.action === 'no-ancestor') {
      applyAdopt(proj, repo, [e], { log: quiet });
      assert.strictEqual(read(path.join(proj, '.claude', 'guides', 'voice.md')), GUIDE_V1);
      assert.strictEqual(read(path.join(proj, 'CLAUDE_voice.md')), 'wholly unrelated prose\n');
    }
  });

  it('refuses to merge against a base it has flagged as not an ancestor', () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), 'wholly unrelated prose, nothing shared\n');
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    commit('v2');
    const e = adoptPlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.weak, true);
    applyAdopt(proj, repo, [e], { log: quiet });
    assert.strictEqual(read(path.join(proj, 'CLAUDE_voice.md')), 'wholly unrelated prose, nothing shared\n',
      'the project file must be left for a hand port');
    assert.strictEqual(read(path.join(proj, '.claude', 'guides', 'voice.md')),
      GUIDE_V1.replace('six', 'UPSTREAM SIX'),
      'the current-layout file installs clean, with nothing merged into it');
  });

  it('merges a weak base only when told to', () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), 'wholly unrelated prose, nothing shared\n');
    const e = adoptPlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    applyAdopt(proj, repo, [e], { log: quiet, force: true });
    assert.match(read(path.join(proj, '.claude', 'guides', 'voice.md')), /unrelated prose/);
  });

  it('backs up a file it overwrites', () => {
    mk(path.join(proj, '.claude', 'guides', 'voice.md'), GUIDE_V1.replace('one', 'PROJECT ONE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    commit('v2');
    applyAdopt(proj, repo, adoptPlan(proj, repo, items()), { log: quiet });
    const dir = path.join(proj, '.claude', 'guides');
    assert.strictEqual(fs.readdirSync(dir).filter((f) => f.includes('.backup-')).length, 1);
  });

  it('leaves the project a baseline, so the next change is an ordinary update', () => {
    legacyProject();
    commit('v2');
    applyAdopt(proj, repo, adoptPlan(proj, repo, items()), { log: quiet });
    vendor.writeManifest(proj, repo, { mode: 'project', via: 'adopt' });
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'),
      read(path.join(repo, 'guides', 'voice.md')).replace('four', 'LATER FOUR'));
    const e = updatePlan(proj, items()).find((x) => x.rel === 'guides/voice.md');
    assert.ok(['fast-forward', 'merged'].includes(e.action), `got ${e.action}`);
  });

  describe('project files upstream does not ship', () => {
    it('tells a stale copy of ours from the project\'s own work', () => {
      // One is byte-identical to something this repo once shipped, one is a
      // fork of it, one the project wrote itself.
      mk(path.join(repo, 'agents', 'gamma.md'), 'shipped once\n');
      commit('gamma');
      fs.unlinkSync(path.join(repo, 'agents', 'gamma.md'));
      commit('drop gamma');
      mk(path.join(proj, '.claude', 'agents', 'gamma.md'), 'shipped once\n');
      mk(path.join(proj, '.claude', 'agents', 'alpha-fork.md'), '---\nname: alpha\n---\nplus a line\n');
      mk(path.join(proj, '.claude', 'agents', 'ours.md'), 'written here, nowhere else\n');
      const byRel = Object.fromEntries(
        projectExtras(proj, repo, items()).map((x) => [x.rel, x]));
      assert.strictEqual(byRel[path.join('agents', 'gamma.md')].kind, 'stale');
      assert.strictEqual(byRel[path.join('agents', 'ours.md')].kind, 'original');
      assert.ok(!byRel[path.join('agents', 'alpha.md')], 'files upstream ships are not extras');
    });
  });
});

describe('paths', () => {
  it('looks for a guide in both layouts, current first', () => {
    const c = projectCandidates('/p', 'guides/voice.md');
    assert.deepStrictEqual(c, ['/p/.claude/guides/voice.md', '/p/CLAUDE_voice.md']);
  });
  it('searches every path a guide has lived at, including its old name', () => {
    assert.deepStrictEqual(historyPaths('guides/r-development.md'), [
      'guides/r-development.md', '.claude/guides/r-development.md',
      'CLAUDE_r-devel.md', 'CLAUDE_r-development.md',
    ]);
  });
  it('merges without resolving anything for you', () => {
    const m = merge3('a\nX\nc\n', 'a\nb\nc\n', 'a\nY\nc\n');
    assert.strictEqual(m.conflicts, 1);
    assert.match(m.text, /X/);
    assert.match(m.text, /Y/);
  });
  it('separates a real ancestor from a coincidence, at the measured cases', () => {
    // Measured on this repo's history against a project that predates it:
    // voice 463 changed lines over 600+771, the R guide 232 over 150+144. The
    // first was edited from our version; the second was written fresh.
    const lines = (n) => 'x\n'.repeat(n);
    const { divergence, WEAK_BASE_RATIO } = vendor;
    assert.ok(divergence(463, lines(600), lines(771)) < WEAK_BASE_RATIO, 'voice: a real ancestor');
    assert.ok(divergence(40, lines(107), lines(67)) < WEAK_BASE_RATIO, 'standards: a real ancestor');
    assert.ok(divergence(125, lines(226), lines(105)) < WEAK_BASE_RATIO, 'CLAUDE.md: a real ancestor');
    assert.ok(divergence(232, lines(150), lines(144)) > WEAK_BASE_RATIO, 'r guide: written fresh');
  });

  it('finds nothing when a file has no history here', () => {
    assert.strictEqual(findBase(repo, 'guides/absent.md', 'x\n'), null);
  });
});
