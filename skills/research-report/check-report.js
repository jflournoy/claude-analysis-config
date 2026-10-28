#!/usr/bin/env node
'use strict';
/**
 * Checks a research-report write-up against the R output it was written from.
 *
 *   node check-report.js --source out.txt [--source more.txt] \
 *        [--apa apa_results.md] [--stakeholder stakeholder_summary.md]
 *
 * Provenance: every number in either file must be the source number rounded to
 * the decimals shown, its leading-zero-dropped form, or a proportion shown as a
 * percentage. Anything else must be declared in an HTML comment:
 *
 *   <!-- derived: 14 = 59.4 - 45.2 -->   arithmetic on source numbers, re-checked here
 *   <!-- context: 5 = top of the 1 to 5 scale, from the user -->   listed, not checked
 *
 * Lint: the APA conventions and stakeholder rules that a pattern can decide.
 *
 * Exit 0 clean, 1 findings, 2 bad invocation. Node builtins only.
 */

const fs = require('node:fs');

const NUM = /(?<![\w.])[-−]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?(?![\w.]*[A-Za-z_])/gi;

/** Blank out code and comments, keeping offsets so line numbers stay right. */
function maskCode(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/```[\s\S]*?```/g, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function extractNumbers(text) {
  const out = [];
  for (const m of text.matchAll(NUM)) {
    const raw = m[0];
    // "1-5" is a range: the hyphen follows a digit, so it is not a minus sign.
    const hyphenRange = /^-/.test(raw) && m.index > 0 && /\d/.test(text[m.index - 1]);
    const clean = (hyphenRange ? raw.slice(1) : raw).replace('−', '-');
    const mantissa = clean.replace(/e.*$/i, '');
    const dot = mantissa.indexOf('.');
    out.push({
      raw: hyphenRange ? raw.slice(1) : raw,
      value: Number(clean),
      decimals: dot < 0 ? 0 : mantissa.length - dot - 1,
      signed: clean.startsWith('-'),
      index: hyphenRange ? m.index + 1 : m.index,
    });
  }
  return out;
}

/** Numbers that are conventions of the write-up, not results. */
function isStructural(text, n) {
  const before = text.slice(Math.max(0, n.index - 12), n.index);
  const after = text.slice(n.index + n.raw.length, n.index + n.raw.length + 16);
  if (/(Table|Figure)\s+$/.test(before)) return true;
  if (/^%?\s*(CI|CrI|HDI|confidence|credible)/i.test(after)) return true;
  if (/(^|\n)\s*$/.test(before) && /^\.\s/.test(after)) return true;
  if (/[<>≤≥]\s*$/.test(before) &&[0.1, 0.05, 0.01, 0.001].includes(n.value)) {
    return true;
  }
  return false;
}

function within(source, n) {
  return Math.abs(source - n.value) <= 0.5 * 10 ** -n.decimals + 1e-12;
}

/** Signed match, then unsigned. Returns 'exact', 'unsigned', or null. */
function trace(n, pool, isPercent) {
  const cands = isPercent ? pool.flatMap((s) => [s, s * 100]) : pool;
  if (cands.some((s) => within(s, n))) return 'exact';
  if (n.signed) return null;
  if (cands.some((s) => within(-s, n))) return 'unsigned';
  return null;
}

/** + - * / and parentheses over numbers; anything else is refused. */
function evaluate(expr) {
  if (!/^[\d\s.+\-*/()e−]+$/i.test(expr)) throw new Error(`unsupported expression: ${expr}`);
  const tokens = expr.replace(/−/g, '-').match(/\d*\.?\d+(?:e[-+]?\d+)?|[-+*/()]/gi);
  let i = 0;
  const peek = () => tokens[i];
  const atom = () => {
    const t = tokens[i++];
    if (t === '(') { const v = sum(); if (tokens[i++] !== ')') throw new Error('unbalanced'); return v; }
    if (t === '-') return -atom();
    const v = Number(t);
    if (Number.isNaN(v)) throw new Error(`bad token ${t}`);
    return v;
  };
  const product = () => {
    let v = atom();
    while (peek() === '*' || peek() === '/') v = tokens[i++] === '*' ? v * atom() : v / atom();
    return v;
  };
  const sum = () => {
    let v = product();
    while (peek() === '+' || peek() === '-') v = tokens[i++] === '+' ? v + product() : v - product();
    return v;
  };
  const v = sum();
  if (i !== tokens.length) throw new Error(`trailing input in ${expr}`);
  return v;
}

function checkProvenance(report, source) {
  const pool = extractNumbers(source).map((n) => n.value);
  const errors = [];
  const derived = [];
  const context = [];

  for (const m of report.matchAll(/<!--\s*context:\s*([-−]?[\d.]+)\s*=\s*([\s\S]*?)-->/g)) {
    context.push({ value: Number(m[1].replace('−', '-')), why: m[2].trim(), line: lineOf(report, m.index) });
  }
  const contextVals = context.map((c) => c.value);

  for (const m of report.matchAll(/<!--\s*derived:\s*([-−]?[\d.]+)\s*=\s*([\s\S]*?)-->/g)) {
    const line = lineOf(report, m.index);
    const claimed = extractNumbers(m[1])[0];
    const inputs = extractNumbers(m[2]);
    const bad = inputs.filter((n) => !trace({ ...n, signed: false, value: Math.abs(n.value) },
      [...pool, ...contextVals], false));
    if (bad.length) {
      errors.push({ rule: 'derived-untraced-input', line,
        text: `derivation of ${m[1]} uses ${bad.map((b) => b.raw).join(', ')}, not in the source` });
      continue;
    }
    let actual;
    try { actual = evaluate(m[2].trim()); } catch (e) {
      errors.push({ rule: 'derived-bad-expression', line, text: e.message });
      continue;
    }
    if (!within(actual, claimed)) {
      errors.push({ rule: 'derived-mismatch', line,
        text: `${m[1]} declared, but ${m[2].trim()} = ${actual}` });
      continue;
    }
    derived.push({ value: claimed.value, expr: m[2].trim(), line });
  }

  const masked = maskCode(report);
  const known = [...pool, ...contextVals, ...derived.map((d) => d.value)];
  const untraced = [];
  const signDropped = [];
  for (const n of extractNumbers(masked)) {
    if (isStructural(masked, n)) continue;
    const isPercent = /^\s*%/.test(masked.slice(n.index + n.raw.length));
    const how = trace(n, known, isPercent);
    const where = { raw: n.raw, line: lineOf(masked, n.index) };
    if (!how) untraced.push(where);
    else if (how === 'unsigned') signDropped.push(where);
  }
  return { untraced, signDropped, derived, context, errors };
}

function lintLines(text, checks) {
  const errs = [];
  maskCode(text).split('\n').forEach((line, i) => {
    for (const [rule, re, msg] of checks) {
      for (const m of line.matchAll(re)) errs.push({ rule, line: i + 1, text: `${msg}: ${m[0].trim()}` });
    }
  });
  return errs;
}

const APA_CHECKS = [
  ['p-zero', /\*?p\*?\s*=\s*(?:0(?:\.0+)?|\.0+)(?![\d.])/g, 'R rounds to zero; write p < .001'],
  ['p-sci', /\*?p\*?\s*[=<]\s*\d(?:\.\d+)?e-?\d+/gi, 'write p < .001, not scientific notation'],
  ['leading-zero', /(?:\*p\*|\*r\*|\*R²\*|(?<![\w*])p|η²(?:_p)?|η_p²|ω²|ICC\S*|α)\s*[=<>]\s*-?0\.\d*[1-9]/g,
    'bounded by 1: drop the leading zero'],
  ['greek-italic', /[*_][βηωαχρστμ][^*_\s]{0,6}[*_]/g, 'Greek symbols stay roman'],
  ['latin-roman', /(?<![*\w])(?:p|t|F|M|SD|SE|b|d|r|z|N|n|df)(?=\s*[=(<>])/g, 'italicize Latin symbols'],
  ['stars', /(?<=^|[\s|])[-−]?\d[\d.]*\*{1,3}(?=[\s|,;)]|$)/g, 'report the p-value, not stars'],
];

function lintApa(text) {
  return lintLines(text, APA_CHECKS);
}

const JARGON = /\bp\s*[<=>]|p-value|\bANOVA\b|t-test|regression|coefficient|confidence interval|credible interval|posterior|standard deviation|effect size|interaction term|interaction effect|simple slope|moderator|moderation|[βηχω]|\*[A-Za-z]{1,2}\*\s*=/gi;

function lintStakeholder(text) {
  const errs = lintLines(text, [
    ['jargon', JARGON, 'no statistical notation or jargon for this audience'],
    ['percent-change', /\d+(?:\.\d+)?\s*%\s+(?:higher|lower|more|less|increase|decrease|greater|fewer)\b/gi,
      'say percentage points, or "X times"'],
    ['pct-decimals', /\d+\.\d+\s*%/g, 'round percentages to whole numbers'],
    ['decimals', /(?<![\w.])\d+\.(?:\d|\d{3,})(?![\d%]|\s*%)/g, 'non-percentage numbers take two decimals'],
  ]);
  maskCode(text).split('\n').forEach((line, i) => {
    if (line.trim() && !/^\s*(?:[-*+]\s|#)/.test(line)) {
      errs.push({ rule: 'not-bullet', line: i + 1, text: `bullets only: ${line.trim().slice(0, 60)}` });
    }
  });
  return errs;
}

function parseArgs(argv) {
  const a = { source: [], apa: null, stakeholder: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (!['--source', '--apa', '--stakeholder'].includes(k) || v === undefined) {
      throw new Error(`unrecognized argument: ${k}`);
    }
    if (k === '--source') a.source.push(v); else a[k.slice(2)] = v;
    i++;
  }
  if (!a.source.length) throw new Error('--source is required: the R output the report was written from');
  if (!a.apa && !a.stakeholder) throw new Error('give --apa, --stakeholder, or both');
  return a;
}

function readOrDie(p) {
  if (!fs.existsSync(p)) throw new Error(`file not found: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function main(argv) {
  let args, source;
  const files = [];
  try {
    args = parseArgs(argv);
    source = args.source.map(readOrDie).join('\n');
    if (args.apa) files.push({ path: args.apa, kind: 'apa', text: readOrDie(args.apa) });
    if (args.stakeholder) files.push({ path: args.stakeholder, kind: 'stakeholder', text: readOrDie(args.stakeholder) });
  } catch (e) {
    process.stderr.write(`check-report: ${e.message}\n`);
    return 2;
  }

  let findings = 0;
  for (const f of files) {
    const prov = checkProvenance(f.text, source);
    const lint = f.kind === 'apa' ? lintApa(f.text) : lintStakeholder(f.text);
    const out = [];
    for (const u of prov.untraced) out.push(`  ${f.path}:${u.line}  untraced  ${u.raw} is not in the source`);
    for (const e of [...prov.errors, ...lint]) out.push(`  ${f.path}:${e.line}  ${e.rule}  ${e.text}`);
    findings += out.length;
    console.log(`${f.path}: ${out.length ? `${out.length} finding(s)` : 'clean'}`);
    out.forEach((l) => console.log(l));
    for (const s of prov.signDropped) {
      console.log(`  ${f.path}:${s.line}  note  ${s.raw} matches a negative source value; check the prose says which way`);
    }
    for (const c of prov.context) console.log(`  ${f.path}:${c.line}  context  ${c.value} = ${c.why}`);
    for (const d of prov.derived) console.log(`  ${f.path}:${d.line}  derived  ${d.value} = ${d.expr}`);
  }
  return findings ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { extractNumbers, checkProvenance, lintApa, lintStakeholder, evaluate, main };
