const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const vendor = require('../vendor.js');
const { payload, plan, installProject, classify } = require('../install.js');

const {
  updatePlan, applyUpdate, orphanedBaselines, projectExtras,
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
    updatePlan(proj, repo, items());
    assert.strictEqual(read(guide()), before);
  });

  it('does nothing when upstream has not moved', () => {
    install();
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.action, 'unchanged');
  });

  it('adds a skill that upstream shipped after the project was installed', () => {
    install();
    mk(path.join(repo, 'skills', 'report', 'SKILL.md'), '---\nname: report\n---\n');
    mk(path.join(repo, 'skills', 'report', 'check.js'), '// check');
    const entries = updatePlan(proj, repo, items());
    const skill = entries.filter((x) => x.rel.startsWith('skills/'));
    assert.deepStrictEqual(skill.map((x) => [x.rel, x.action]).sort(),
      [['skills/report/SKILL.md', 'add'], ['skills/report/check.js', 'add']]);
    applyUpdate(proj, entries, { log: quiet });
    assert.strictEqual(read(path.join(proj, '.claude', 'skills', 'report', 'check.js')), '// check');
    assert.strictEqual(readBaseline(proj, 'skills/report/check.js'), '// check');
  });

  it('takes upstream wholesale when the project never touched the file', () => {
    install();
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'SIX'));
    const entries = updatePlan(proj, repo, items());
    assert.strictEqual(entries.find((x) => x.rel === 'guides/voice.md').action, 'fast-forward');
    applyUpdate(proj, entries, { log: quiet });
    assert.match(read(guide()), /SIX/);
  });

  it('keeps the project edit and takes the upstream one', () => {
    install();
    fs.writeFileSync(guide(), GUIDE_V1.replace('one', 'PROJECT ONE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    const entries = updatePlan(proj, repo, items());
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
    const entries = updatePlan(proj, repo, items());
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
    const entries = updatePlan(proj, repo, items());
    const e = entries.find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.action, 'removed');
    assert.strictEqual(e.upstreamMoved, true);
    applyUpdate(proj, entries, { log: quiet });
    assert.ok(!fs.existsSync(guide()), 'a deletion is a decision, not damage to repair');
  });

  it('ships a file the project does not have yet', () => {
    install();
    mk(path.join(repo, 'agents', 'beta.md'), '---\nname: beta\n---\n');
    const entries = updatePlan(proj, repo, items());
    assert.strictEqual(entries.find((x) => x.rel === 'agents/beta.md').action, 'add');
    applyUpdate(proj, entries, { log: quiet });
    assert.ok(fs.existsSync(path.join(proj, '.claude', 'agents', 'beta.md')));
  });

  it('adopts a file it has no baseline for, and will not merge it against a weak base', () => {
    mk(path.join(proj, 'CLAUDE.md'), 'project rules');
    install();
    const entries = updatePlan(proj, repo, items());
    const e = entries.find((x) => x.rel === 'CLAUDE.md');
    assert.strictEqual(e.action, 'merge');
    assert.strictEqual(e.weak, true);
    applyUpdate(proj, entries, { log: quiet });
    assert.strictEqual(read(path.join(proj, 'CLAUDE.md')), 'project rules');
    assert.strictEqual(read(path.join(proj, 'CLAUDE.md.upstream')), read(path.join(repo, 'CLAUDE.md'))
      .replace('~/.claude/guides/', '.claude/guides/'));
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
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
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
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.legacy, true);
    assert.strictEqual(e.oursPath, path.join(proj, 'CLAUDE_voice.md'));
    assert.strictEqual(e.action, 'merge');
    applyUpdate(proj, [e], { log: quiet });
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
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'guides/r-development.md');
    assert.strictEqual(e.base.path, 'CLAUDE_r-devel.md');
    assert.strictEqual(e.conflicts, 0);
    assert.match(e.merged, /PROJECT ONE/);
  });

  it('plans without touching anything', () => {
    legacyProject();
    commit('v2');
    const before = read(path.join(proj, 'CLAUDE_voice.md'));
    updatePlan(proj, repo, items());
    assert.strictEqual(read(path.join(proj, 'CLAUDE_voice.md')), before);
    assert.ok(!fs.existsSync(path.join(proj, '.claude', 'guides', 'voice.md')));
  });

  it('will not merge a file with no ancestor here, and says which to port', () => {
    mk(path.join(proj, 'CLAUDE.md'), 'nothing in common with upstream at all\n');
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'CLAUDE.md');
    assert.strictEqual(e.action, 'merge');
    assert.strictEqual(e.weak, true, 'a file sharing nothing with history is not a descendant');
  });

  it('installs the current-layout file when only a legacy one exists with no ancestor', () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), 'wholly unrelated prose\n');
    git(['rm', '-q', 'guides/voice.md']);
    commit('drop guide from history path');
    mk(path.join(repo, 'guides', 'voice.md'), GUIDE_V1);
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    if (e.action === 'no-ancestor') {
      applyUpdate(proj, [e], { log: quiet });
      assert.strictEqual(read(path.join(proj, '.claude', 'guides', 'voice.md')), GUIDE_V1);
      assert.strictEqual(read(path.join(proj, 'CLAUDE_voice.md')), 'wholly unrelated prose\n');
    }
  });

  it('refuses to merge against a base it has flagged as not an ancestor', () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), 'wholly unrelated prose, nothing shared\n');
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    commit('v2');
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
    assert.strictEqual(e.weak, true);
    applyUpdate(proj, [e], { log: quiet });
    assert.strictEqual(read(path.join(proj, 'CLAUDE_voice.md')), 'wholly unrelated prose, nothing shared\n',
      'the project file must be left for a hand port');
    assert.strictEqual(read(path.join(proj, '.claude', 'guides', 'voice.md')),
      GUIDE_V1.replace('six', 'UPSTREAM SIX'),
      'the current-layout file installs clean, with nothing merged into it');
  });

  it('merges a weak base only when told to', () => {
    mk(path.join(proj, 'CLAUDE_voice.md'), 'wholly unrelated prose, nothing shared\n');
    const e = updatePlan(proj, repo, items(), { force: true }).find((x) => x.rel === 'guides/voice.md');
    applyUpdate(proj, [e], { log: quiet });
    assert.match(read(path.join(proj, '.claude', 'guides', 'voice.md')), /unrelated prose/);
  });

  it('backs up a file it overwrites', () => {
    mk(path.join(proj, '.claude', 'guides', 'voice.md'), GUIDE_V1.replace('one', 'PROJECT ONE'));
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'), GUIDE_V1.replace('six', 'UPSTREAM SIX'));
    commit('v2');
    applyUpdate(proj, updatePlan(proj, repo, items()), { log: quiet });
    const dir = path.join(proj, '.claude', 'guides');
    assert.strictEqual(fs.readdirSync(dir).filter((f) => f.includes('.backup-')).length, 1);
  });

  it('leaves the project a baseline, so the next change is an ordinary update', () => {
    legacyProject();
    commit('v2');
    applyUpdate(proj, updatePlan(proj, repo, items()), { log: quiet });
    vendor.writeManifest(proj, repo, { mode: 'project', via: 'adopt' });
    fs.writeFileSync(path.join(repo, 'guides', 'voice.md'),
      read(path.join(repo, 'guides', 'voice.md')).replace('four', 'LATER FOUR'));
    const e = updatePlan(proj, repo, items()).find((x) => x.rel === 'guides/voice.md');
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

/*
 * Issue #1: a file adopt skipped had no baseline, --update said "run --adopt",
 * and --adopt said "already vendored, use --update". Every message names a
 * command; these tests run the commands the tool actually prints, so a message
 * that points at a refused command fails here rather than in someone's project.
 */
describe('no file is left with nowhere to go', () => {
  const { main } = require('../install.js');
  const UNRELATED = 'nothing in common with upstream at all\n';
  const claudeMd = () => path.join(proj, 'CLAUDE.md');
  const sidecar = () => `${claudeMd()}.upstream`;

  const run = (argv) => {
    const lines = [];
    const sink = (s = '') => lines.push(...String(s).split('\n'));
    const code = main(argv, { repo, log: sink, err: sink });
    return { code, lines, text: lines.join('\n') };
  };
  const printedCommands = (lines) => lines
    .map((l) => l.match(/node \S*install\.js((?: \S+)+)$/))
    .filter(Boolean)
    .map((m) => m[1].trim().split(' '));
  const handPort = () => fs.writeFileSync(claudeMd(), `${read(claudeMd())}\n${read(sidecar())}`);
  const tracked = () => items().every((i) => readBaseline(proj, i.rel) !== null);

  it('gets a file with no real ancestor tracked by following the printed commands', () => {
    mk(claudeMd(), UNRELATED);
    const first = run(['--update', proj, '--apply']);
    assert.strictEqual(first.code, 0, first.text);
    assert.strictEqual(read(claudeMd()), UNRELATED, 'the project file is never overwritten');
    assert.strictEqual(readBaseline(proj, 'CLAUDE.md'), null);
    assert.ok(fs.existsSync(sidecar()), 'upstream is left beside the file for the hand port');

    const again = run(['--update', proj, '--apply']);
    assert.strictEqual(again.code, 0, again.text);
    const resolves = printedCommands(again.lines).filter((c) => c[0] === '--resolve');
    assert.strictEqual(resolves.length, 1, again.text);

    handPort();
    const r = run(resolves[0]);
    assert.strictEqual(r.code, 0, r.text);
    assert.ok(!fs.existsSync(sidecar()));
    assert.ok(tracked(), 'every shipped file has a baseline once the port is resolved');
    assert.match(read(claudeMd()), /nothing in common/);

    fs.writeFileSync(path.join(repo, 'CLAUDE.md'), read(path.join(repo, 'CLAUDE.md')) + 'LATER LINE\n');
    const later = run(['--update', proj, '--apply']);
    assert.strictEqual(later.code, 0, later.text);
    assert.match(read(claudeMd()), /LATER LINE/, 'the next upstream change arrives as an ordinary merge');
    assert.match(read(claudeMd()), /nothing in common/);
  });

  it('runs every command it prints without being refused', () => {
    mk(claudeMd(), UNRELATED);
    run(['--update', proj, '--apply']);
    const { lines } = run(['--update', proj]);
    const cmds = printedCommands(lines);
    assert.ok(cmds.length > 0, 'an unresolved file must name its next step');
    handPort();
    for (const c of cmds) {
      const r = run(c);
      assert.strictEqual(r.code, 0, `${c.join(' ')} was refused:\n${r.text}`);
    }
  });

  it('keeps --force reachable for a weak base after the project is vendored', () => {
    mk(claudeMd(), UNRELATED);
    install();
    const dry = run(['--update', proj]);
    const force = printedCommands(dry.lines).find((c) => c.includes('--force'));
    assert.ok(force, `the weak-base line names the --force command:\n${dry.text}`);
    const r = run(force);
    assert.strictEqual(r.code, 0, r.text);
    assert.notStrictEqual(readBaseline(proj, 'CLAUDE.md'), null);
  });

  it('brings in a CLAUDE.md that --project declined to overwrite', () => {
    mk(claudeMd(), UNRELATED);
    install();
    assert.strictEqual(readBaseline(proj, 'CLAUDE.md'), null);
    run(['--update', proj, '--apply']);
    const resolve = printedCommands(run(['--update', proj]).lines).find((c) => c[0] === '--resolve');
    assert.ok(resolve);
    handPort();
    assert.strictEqual(run(resolve).code, 0);
    assert.ok(tracked());
  });

  it('records what the port was made against, so later upstream changes still merge in', () => {
    mk(claudeMd(), UNRELATED);
    run(['--update', proj, '--apply']);
    const portedAgainst = read(sidecar());
    fs.writeFileSync(path.join(repo, 'CLAUDE.md'), read(path.join(repo, 'CLAUDE.md')) + 'MOVED AFTER\n');
    const mid = run(['--update', proj, '--apply']);
    assert.strictEqual(read(sidecar()), portedAgainst, 'the sidecar is not rewritten under the user');
    assert.match(mid.text, /upstream has moved/);
    handPort();
    assert.strictEqual(run(['--resolve', proj, 'CLAUDE.md', '--apply']).code, 0);
    assert.strictEqual(readBaseline(proj, 'CLAUDE.md'), portedAgainst);
    run(['--update', proj, '--apply']);
    assert.match(read(claudeMd()), /MOVED AFTER/);
  });

  it('writes nothing on a dry run, sidecars included', () => {
    mk(claudeMd(), UNRELATED);
    run(['--update', proj]);
    assert.ok(!fs.existsSync(sidecar()));
    assert.ok(!fs.existsSync(path.join(proj, '.claude')));
  });

  it('honours a deletion resolved while unmerged', () => {
    mk(claudeMd(), UNRELATED);
    run(['--update', proj, '--apply']);
    fs.unlinkSync(claudeMd());
    assert.strictEqual(run(['--resolve', proj, 'CLAUDE.md', '--apply']).code, 0);
    run(['--update', proj, '--apply']);
    assert.ok(!fs.existsSync(claudeMd()), 'a resolved deletion stays deleted');
  });

  it('accepts --adopt on a vendored project, as --update', () => {
    install();
    const r = run(['--adopt', proj]);
    assert.strictEqual(r.code, 0, r.text);
    assert.match(r.text, /--adopt is now part of --update/);
  });

  describe('--resolve refuses', () => {
    beforeEach(() => {
      mk(claudeMd(), UNRELATED);
      run(['--update', proj, '--apply']);
    });

    it('a file this repo does not ship', () => {
      const r = run(['--resolve', proj, 'agents/nope.md', '--apply']);
      assert.strictEqual(r.code, 1);
      assert.match(r.text, /does not ship/);
    });

    it('a file that already has a baseline', () => {
      const before = readBaseline(proj, 'guides/voice.md');
      const r = run(['--resolve', proj, 'guides/voice.md', '--apply']);
      assert.strictEqual(r.code, 1);
      assert.match(r.text, /already tracked/);
      assert.strictEqual(readBaseline(proj, 'guides/voice.md'), before);
    });

    it('a file with no upstream copy beside it, naming the command that makes one', () => {
      fs.unlinkSync(sidecar());
      const r = run(['--resolve', proj, 'CLAUDE.md', '--apply']);
      assert.strictEqual(r.code, 1);
      assert.ok(printedCommands(r.lines).some((c) => c[0] === '--update'), r.text);
    });

    it('a file that still has conflict markers', () => {
      fs.writeFileSync(claudeMd(), '<<<<<<< project\na\n=======\nb\n>>>>>>> upstream\n');
      const r = run(['--resolve', proj, 'CLAUDE.md', '--apply']);
      assert.strictEqual(r.code, 1);
      assert.match(r.text, /conflict markers/);
      assert.strictEqual(readBaseline(proj, 'CLAUDE.md'), null);
      assert.ok(fs.existsSync(sidecar()));
    });

    it('anything without --apply', () => {
      handPort();
      const r = run(['--resolve', proj, 'CLAUDE.md']);
      assert.strictEqual(r.code, 0);
      assert.strictEqual(readBaseline(proj, 'CLAUDE.md'), null);
      assert.ok(fs.existsSync(sidecar()));
    });
  });

  describe('every way a file can arrive with no baseline', () => {
    // guides/fresh.md is shipped but never committed, so nothing in history is
    // its ancestor; the rest have a history the project's copy does not share.
    const fresh = () => mk(path.join(repo, 'guides', 'fresh.md'), 'fresh guide\n');
    const FIXTURES = {
      'same path, weak base': () => mk(claudeMd(), UNRELATED),
      'same path, no ancestor': () => { fresh(); mk(path.join(proj, '.claude', 'guides', 'fresh.md'), 'mine\n'); },
      'legacy path, weak base': () => mk(path.join(proj, 'CLAUDE_voice.md'), UNRELATED),
      'legacy path, no ancestor': () => { fresh(); mk(path.join(proj, 'CLAUDE_fresh.md'), 'mine\n'); },
      'CLAUDE.md that --project declined': () => { mk(claudeMd(), UNRELATED); install(); },
    };
    const sidecars = (dir) => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
      .filter((f) => f.isFile() && f.name.endsWith('.upstream'))
      .map((f) => path.join(f.parentPath ?? f.path, f.name));

    for (const [name, setup] of Object.entries(FIXTURES)) {
      it(`${name}: every printed command is accepted and the file ends up tracked`, () => {
        setup();
        const dry = run(['--update', proj]);
        const applied = run(['--update', proj, '--apply']);
        assert.strictEqual(applied.code, 0, applied.text);
        for (const sc of sidecars(proj)) {
          const file = sc.slice(0, -'.upstream'.length);
          fs.writeFileSync(file, `${read(file)}\n${read(sc)}`);
        }
        const cmds = [...printedCommands(dry.lines), ...printedCommands(applied.lines)]
          .filter((c) => !c.includes('--force'));
        const seen = new Set();
        for (const c of cmds) {
          if (seen.has(c.join(' '))) continue;
          seen.add(c.join(' '));
          const r = run(c);
          assert.strictEqual(r.code, 0, `${c.join(' ')} was refused:\n${r.text}\n--- dry run said:\n${dry.text}`);
        }
        assert.deepStrictEqual(sidecars(proj), []);
        assert.ok(tracked(), `untracked: ${items().filter((i) => readBaseline(proj, i.rel) === null).map((i) => i.rel)}`);
      });
    }

    it('a --force dry run says the weak base will be merged, not set aside', () => {
      mk(claudeMd(), UNRELATED);
      const dry = run(['--update', proj, '--force']);
      assert.doesNotMatch(dry.text, /\.upstream/);
      run(['--update', proj, '--force', '--apply']);
      assert.ok(!fs.existsSync(sidecar()));
      assert.notStrictEqual(readBaseline(proj, 'CLAUDE.md'), null);
    });

    it('counts as waiting only the files that have a --resolve to wait on', () => {
      FIXTURES['legacy path, no ancestor']();
      const r = run(['--update', proj, '--apply']);
      assert.doesNotMatch(r.text, /wait on a hand port/);
    });
  });

  it('refuses to write through a symlink into wherever it points', () => {
    const outside = path.join(tmp, 'outside.md');
    fs.writeFileSync(outside, 'not the project\'s\n');
    fs.mkdirSync(path.join(proj, '.claude', 'agents'), { recursive: true });
    fs.symlinkSync(outside, path.join(proj, '.claude', 'agents', 'alpha.md'));
    const r = run(['--update', proj, '--apply']);
    assert.strictEqual(r.code, 1);
    assert.match(r.text, /symlink/);
    assert.strictEqual(read(outside), 'not the project\'s\n');
  });

  it('names the sidecar so Claude Code never loads it as an agent, command or hook', () => {
    for (const rel of ['agents/a.md', 'commands/c.md', 'hooks/h.js', 'skills/s/SKILL.md']) {
      const p = vendor.sidecarPath(path.join(proj, '.claude', rel));
      assert.ok(!/\.(md|js|cjs|mjs)$/.test(p), p);
    }
  });
});
