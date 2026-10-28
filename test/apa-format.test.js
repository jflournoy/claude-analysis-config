const { it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HELPERS = path.join(__dirname, '..', 'skills', 'research-report', 'apa-format.R');
const CHECKS = path.join(__dirname, 'apa-format.check.R');

it('apa-format.R formats APA numbers and refuses what it cannot format', (t) => {
  const r = spawnSync('Rscript', ['--vanilla', CHECKS, HELPERS], { encoding: 'utf8' });
  if (r.error && r.error.code === 'ENOENT') {
    t.skip('Rscript not found on PATH; the R formatting helpers were not checked');
    return;
  }
  assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /^ok/m);
});
