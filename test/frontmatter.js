'use strict';

/**
 * Minimal frontmatter parse, shared by the agent and command suites. Deliberately
 * strict about the delimiters and about escaping, because both failures this guards
 * against are silent: the file still looks fine, and the thing just never loads.
 *
 *   - a closing `---` glued onto the last key, or replaced by a dashed rule, leaves
 *     the block unterminated
 *   - a markdown autofixer rewriting `[Bash]` to `\[Bash]` turns a YAML flow sequence
 *     into the literal string `\[Bash]`
 */
function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return { error: 'file does not open with --- on its own line' };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { error: 'no closing --- on its own line' };
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  for (const [key, value] of Object.entries(fields)) {
    if (/\\[[\]*_`]/.test(value)) {
      return { error: `frontmatter value for "${key}" carries a markdown backslash escape: ${value}` };
    }
  }
  return { fields };
}

module.exports = { parseFrontmatter };
