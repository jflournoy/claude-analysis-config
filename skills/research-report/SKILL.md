---
name: research-report
description: "Turn statistical results into two deliverables: an APA 7th-edition results write-up and a plain-language stakeholder summary for a slide deck. Works from pasted R output (every number then checked against it by a script) or from model objects in a Quarto report (numbers computed inline, never retyped). Covers mixed models, t-tests, ANOVA, descriptives, path analysis, mediation, moderation, and Bayesian models fit with brms or cmdstanr. Trigger on \"write this up in APA\", \"turn this R output into a results section\", \"make a stakeholder version of this\", \"APA table for these results\", or R output followed by a request to report or explain the findings."
---

<!-- Adapted from Carol Lee's research-report skill (https://github.com/goose-sploot), written for Intuit for Education. -->

# APA and plain-language reporting

Two files come out of this: `apa_results.md`, a rigorous results write-up for a technical
reader, and `stakeholder_summary.md`, bullets a program manager can paste into a deck. Every
write-up reports the same statistics the same way and refuses the same overclaims.

The failure this skill is built around is a wrong number that looks right. A transposed
digit, the SE from the next row, a CI bound copied from the wrong line: none of these
crash, and all of them survive a read-through. So no number reaches either file on the
model's say-so. Either a script checks it against the output it came from, or code
computes it in place.

Prose follows [~/.claude/guides/voice.md](~/.claude/guides/voice.md): the APA narrative at
the **paper** register, the stakeholder bullets at **commentary**. Any R code follows
[~/.claude/guides/r-development.md](~/.claude/guides/r-development.md) (data.table, not
tidyverse). A project's own `CLAUDE.md` may add house rules for this skill (chart specs,
audience, terminology); those override the defaults here.

## Step 0: Gather context before writing anything

The output alone is never enough. Ask, grouped and only for what is missing:

1. **What each variable means**, in plain terms, with the outcome's measure and scale. R
   output uses codes (`play_cat`, `MM`, `conf_avg6`); get the real labels.
2. **Sample and design**: *N*, groups or conditions, whether observations are nested or
   repeated (within person, within site), how groups were formed.
3. **The question** the analysis was meant to answer, and the expected direction.
4. **Causality (required).** Does the design support a causal claim (random assignment, an
   experimental manipulation), or is it observational? No causal language until this is
   answered. Mediation is a causal claim about a chain of effects, so a mediation model on
   observational or cross-sectional data gets the same treatment: report the indirect
   effect as an association consistent with mediation, never as "X works through M."

What the user cannot supply goes in the flagged gaps, not into a guess.

## Step 1: Choose the mode, and say which

**Paste mode** is for console output the user hands over. Save the output verbatim, before
reading it closely, to `report_source.txt` beside the two deliverables. That file is what
the checker traces every number back to, so it must be the user's text, unedited.

**Quarto mode** is for results that live in R objects: a targets pipeline, a fitted model
in the session, a project already reporting in Quarto. The write-up is a `.qmd` whose
numbers are inline R calls on the model object, formatted by `apa-format.R` (in this
skill's directory). Copy that file into the project's `R/`, and follow the R guide's report
rules: the report reads targets with `tar_read()`, never fits a model itself.

```markdown
Time predicted higher scores, *b* = `r apa_num(b["time_post"])`,
*p* `r apa_p(p["time_post"])`, 95% CI `r apa_ci(ci["time_post", 1], ci["time_post", 2])`.
```

If both are possible, use Quarto mode and say so. If neither fits (the user pasted output
but the objects are elsewhere), paste mode, and say that too.

## Step 2: Parse and clean

- **`p = 0`, `0.000`, `< 2e-16` all become *p* < .001.** R prints rounded zeros; a true
  zero *p*-value does not exist.
- **Flag missing pieces**: df, test statistics, effect sizes, *N*, CIs. Mark each in the
  write-up as `[df missing]` or similar. Never fill one in.
- **Flag assumption and quality problems** rather than reporting around them: singular fit,
  convergence warnings, divergences, implausible magnitudes, signs that contradict the
  text, a *p*-value inconsistent with its statistic.
- Map significance stars to actual *p*-values; stars never appear in the APA file.

## Step 3: `apa_results.md`

Flagged gaps first, at the top. Then three parts, in this order.

### A. In-text statistics

Frequentist models:

- Omnibus *F*: *F*(2, 117) = 91.62, *p* < .001, η²_p = .61.
- *t*-test: *t*(118) = 2.80, *p* = .006, *d* = 0.41.
- Mixed model: fixed effects with *b*, *SE*, *df*, *t* or *z*, *p*, 95% CI, and β when
  reported; then the random effects. **Every ICC goes in-text with the random effects**,
  one per grouping level and attached to that level, never to a fixed-effect line:
  "Random effects: student *SD* = 0.79, classroom *SD* = 0.26; ICC_student = .54,
  ICC_classroom = .06."
- Path analysis and mediation: path coefficients (*b* or β) with *SE*, and the indirect
  effect with its bootstrap CI. Mediation rests on the indirect effect and its CI, not on
  the significance of individual paths.
- Moderation: the interaction term, then the simple slopes.
- Post-hoc contrasts: each pair, its adjusted *p*, the adjustment method, the direction.
- Descriptives: *M*, *SD*, *n*, range as appropriate. A fuller set goes in a table (below).

Bayesian models (brms, cmdstanr): no *p*-values and no "significant," anywhere.

- Each effect: posterior median (or mean; say which), 95% credible interval (equal-tailed
  or HDI; say which), and the probability of direction, e.g. *b* = 0.42, 95% CrI [0.31,
  0.52], P(*b* > 0) > .999.
- A region of practical equivalence only if the user supplied its bounds. Never invent one.
- State the priors, in-text or in a note.
- Report the diagnostic gate from
  [~/.claude/guides/bayesian-production.md](~/.claude/guides/bayesian-production.md):
  max R̂, min bulk-ESS and tail-ESS, divergences. A fit that fails the gate (R̂ > 1.01,
  ESS < 400, any divergences) is a flagged gap at the top, and its estimates are not
  interpreted.

**Effect sizes are mandatory when available.** If the output contains one, or one is a
direct read of it (a standardized coefficient, *d*, *r*, η², *R*², an odds ratio), it
appears in all three parts: in-text, narrative, and table. If none is available, flag it
as missing. Do not compute one from assumptions.

**Flag small effects, emphatically when *N* is large.** Rough benchmarks: |*d*| ≈ 0.2,
|*r*| or standardized *b* ≈ 0.1, η² ≈ 0.01. A large sample pushes trivial differences to
*p* < .001, and statistical significance is not practical importance. Say so in the
flagged gaps and again where the effect is reported.

**Formatting.** Italicize Latin-letter symbols (*M*, *SD*, *N*, *n*, *b*, *SE*, *t*, *z*,
*F*, *p*, *r*, *R*², *d*, *df*); keep Greek roman (β, η², η²_p, ω², α, χ²). Two decimals
for most statistics. No leading zero on anything bounded by 1 (*p*, *r*, *R*², ICC, α).
Exact *p* to three decimals, except *p* < .001.

### B. Results narrative

Prose that walks the analysis in its own order: omnibus before contrasts, predictors in a
sensible sequence. Give direction and magnitude, carry the in-text statistics, and name
every result, the null ones included.

### C. Tables

APA 7 table form, carried into Markdown as far as Markdown allows:

- **Number** on its own line in bold (**Table 1**), then the **title** on the next line in
  italic title case (*Fixed Effects Predicting Confidence*).
- **Headers** say what the column holds, with Latin symbols italic and Greek roman:
  *b*, *SE*, *df*, *t*, *p*, β, 95% CI.
- **CIs** in one column as [*LL*, *UL*], not two columns of bounds.
- **No stars in cells.** Exact *p* values in a *p* column.
- **Notes** below the table, in APA order: a general note (*Note.* abbreviations, units,
  *N*, the model, the CI type), then specific notes keyed with superscript letters to a
  cell, row, or column.
- **One effect-size column** whenever an effect size is available.

Layouts by analysis:

- **Regression and mixed models**: one row per predictor; *b*, *SE*, *df*, *t* or *z*,
  *p*, 95% CI, β. Random effects and ICCs in a block of rows below the fixed effects, or
  in the note.
- **ANOVA**: one row per effect; *df*, *F*, *p*, η²_p (or ω²).
- **Correlations**: variables numbered down the side, numbers across the top; *M* and *SD*
  columns first; lower triangle only; no leading zeros; dashes or α on the diagonal (say
  which in the note).
- **Bayesian**: one row per parameter; median (or mean), 95% CrI, P(direction), R̂,
  bulk-ESS. Priors in the note.
- **Descriptives**: every descriptive the output reports, in one table: *M* (*SD*), skew,
  kurtosis, Cronbach's α, % high (top-box). Report % high exactly as given. Never derive
  it from a mean, and never compute a descriptive the output does not contain.

**Pre/post descriptives go wide, not long.** One row per construct. A block of Pre columns
(*M* (*SD*), skew, kurtosis, α, % high), then a matching block of Post columns in the
same order, then a final Δ pp column: post % high minus pre % high, the only computed
value allowed in the table, and only when both sides exist. A construct with one side
leaves the other side and Δ pp blank. Group headers or the note make the blocks
unambiguous.

## Step 4: `stakeholder_summary.md`

The reader is a program manager or executive with little statistical training.

- **Bullets only.** No statistical notation, *p*-values, test names, or jargon
  (coefficient, interaction, posterior, confidence interval, effect size).
- **Lead with the takeaway, then the number.** Keep the numbers; express them plainly.
- **Rounding**: percentages to whole numbers. Every other number to two decimals, on its
  own scale ("2.47 out of 5"). Rounding a raw score to a whole number overstates change.
- **Percentage points, not percent change.** 40% to 55% is "15 percentage points higher,"
  never "38% higher."
- **"X times"** for multiplicative differences ("about 3 times as likely").
- **Name significant effects as significant, with the measure and the size together**:
  "Likelihood to implement significantly increased, from 45% to 59%." The word alone
  reads to this audience as "large," so it never appears without the magnitude beside
  it. A small effect gets that said too: "a small but reliable increase."
- **Bayesian results** in the same plain register, without "significant": "Scores were
  almost certainly higher at Post, by about 0.42 points on the 5-point scale."
- **Null results stay in**, stated plainly: "No meaningful difference between X and Y."
- **Causality** per Step 0: associations ("groups that did X also had higher Y") unless the
  design supports more.
- **Moderation is a gap.** Name it after the outcome (a usage gap, a confidence gap), say
  which group is higher, when, and what happens to the gap: it appears, closes, narrows,
  or widens. "We see a confidence gap at the start: Group A begins lower than Group B. By
  Post, the gap closes."
- Tone: neutral and brief. Confident, not salesy.

## Step 5: Check, in paste mode

Any number in either file that is not a source number rounded as displayed gets declared
in an HTML comment beside it:

```markdown
up 14 percentage points <!-- derived: 14 = 59.4 - 45.2 -->
2.47 out of 5 <!-- context: 5 = top of the 1 to 5 response scale, from the user -->
```

A `derived` value is arithmetic on source numbers, and the checker redoes the arithmetic.
A `context` value comes from the user, not the output; the checker cannot verify it, so it
lists every one for a human to see. Then run:

```bash
node <this skill's directory>/check-report.js --source report_source.txt \
  --apa apa_results.md --stakeholder stakeholder_summary.md
```

It must exit 0. Fix the write-up for each finding; never edit `report_source.txt` to make
a number trace. Show the user the `context`, `derived`, and sign notes it prints. The
checker enforces: provenance, *p* = 0, scientific-notation *p*, leading zeros on bounded
statistics, italic Greek, roman Latin symbols, stars, and on the stakeholder file, bullets
only, jargon, percent-for-points, and rounding.

What it cannot check, check by reading: that the right number sits in the right place (a
traced SE in the *b* column still traces), causal language, null results kept, effect
sizes in all three parts, the ICC placement, the table layout.

In Quarto mode the numbers are code, so the provenance check does not apply. Render the
report and read the result against the same list.

## Step 6: Offer a chart, then Word

**Chart.** After delivering the Markdown, ask which variables the user wants charted, and
chart only those. For a pre/post chart, ask whether to plot means or % high; do not
assume. Use only statistics present in the output. Build it per the `dataviz` skill unless
the project's `CLAUDE.md` gives a chart spec, which then wins. Keep caveats ("descriptive
only") in the write-up or the chat, not on the image. Save a 300 DPI PNG to the project and
tell the user where.

If the spec names a font that is not installed (`fc-list | grep -i <font>` finds nothing),
stop before drawing and tell the user plainly that the font is missing, which files are
needed, and where to install them. Do not draw in a substitute font.

**Word.** After the chart step, ask whether they want a `.docx`. Only on a yes, make one
with the `docx` skill, preserving tables, italics, and APA formatting.

## Never

- Drop or hide a null result.
- Use causal language the design does not support.
- Invent, estimate, or back-fill a statistic. Flag it as missing.
- Write *p* = 0, or put stars in place of values.
- Report a Bayesian result with a *p*-value or the word "significant."
- Deliver a paste-mode write-up the checker has not passed.
