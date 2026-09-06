const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { parseFrontmatter } = require('./frontmatter.js');

const good = '---\nallowed-tools: [Bash]\ndescription: does a thing\n---\n\nBody.\n';

describe('frontmatter parsing', () => {
  it('accepts a well-formed block', () => {
    const { fields, error } = parseFrontmatter(good);
    assert.strictEqual(error, undefined);
    assert.strictEqual(fields['allowed-tools'], '[Bash]');
  });

  describe('the shapes a markdown autofixer leaves behind', () => {
    it('rejects a closing delimiter replaced by a dashed rule', () => {
      const bad = '---\nallowed-tools: [Bash]\n-----------------------------\n\nBody.\n';
      assert.match(parseFrontmatter(bad).error, /no closing ---/);
    });

    it('rejects a backslash-escaped list, which YAML reads as a string', () => {
      const bad = '---\nallowed-tools: \\[Bash]\ndescription: does a thing\n---\n\nBody.\n';
      assert.match(parseFrontmatter(bad).error, /backslash escape/);
    });

    it('rejects a file that does not open with the delimiter', () => {
      assert.match(parseFrontmatter('\n---\nallowed-tools: [Bash]\n---\n').error,
        /does not open with ---/);
    });
  });
});

for (const dir of ['agents', 'commands']) {
  const abs = path.join(__dirname, '..', dir);
  const files = fs.readdirSync(abs).filter((f) => f.endsWith('.md'));
  describe(`${dir}/ frontmatter`, () => {
    it('finds files to check', () => assert.ok(files.length > 0, `no files in ${dir}`));
    for (const file of files) {
      it(`${file} parses`, () => {
        const { error } = parseFrontmatter(fs.readFileSync(path.join(abs, file), 'utf8'));
        assert.strictEqual(error, undefined, `${dir}/${file}: ${error}`);
      });
    }
  });
}
