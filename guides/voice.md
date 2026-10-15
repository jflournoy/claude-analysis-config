# Voice Guide: writing reader-facing prose as John Flournoy

**Load this before writing or editing any prose a reader will see** — report text, figure
captions, README and docs pages, site copy, abstracts, strings a program prints. The goal is
that every sentence a reader meets sounds like John wrote it, at the level of formality the
document calls for.

**This guide is the craft; the project supplies the scope.** Which files it covers, and where
each sits on the register dial, belong in the project's own `CLAUDE.md` — they differ per
repository and cannot be stated once for all of them. See "Declaring scope" below.

The profile is distilled from nine pieces of his writing spanning three registers: journal
papers (a 2016 empirical paper, the 2019 dissertation, the 2024 NeuroImage reliability
paper), commentary and review (a sole-authored 2021 comment, the 2020 DCN methods review,
a 2025 industry whitepaper), and three short conversational pieces for the Developer Success
Lab (a 2024 comment on causal inference, a 2024 comment on whole-trait theory, a 2025
comment on the Challenger disaster). Where sources disagree within a register, the sole- or
first-authored, less copyedited pieces win over lab-house-style passages.

**Unless a project says otherwise, this guide describes the commentary register**, leaning
conversational — the middle of the dial in §0. That is the default because most reader-facing
work sits there. A project whose output is a manuscript should read the paper column; one
whose output is a public site should read the conversational column.

## 0. The register dial

Three positions, from most to least formal. The voice is the same person at every position;
what moves is how much of him is on the page.

| | **Paper** | **Commentary** | **Conversational** |
|---|---|---|---|
| Sources | 2016 empirical, 2019 dissertation, 2024 NeuroImage | 2021 comment, 2020 DCN review, 2025 whitepaper | 2024–25 Developer Success Lab comments |
| Person | we; passive for procedure | we; I in sole-authored | I freely; we for the collective; you, the reader, addressed directly |
| Contractions | none | rare | throughout |
| Sentence length | long, accretive; short ones rare and never in runs | mostly long; an occasional short one as a punch | long by default, but short sentences occur and sometimes run in twos and threes ("Case closed."; "It rewards rereading."; "This recommendation was ignored.") |
| Em-dashes | ~1 per 1000 words, appositive definitions only | ~1 per 1000 | ~2–3 per 1000, still parentheses first |
| Asides | one wry parenthetical per piece | one or two | footnotes carry them: wry glosses, self-aware concessions, extra reading; plus parentheticals |
| Anecdote and feeling | none | none | yes, and used to open ("Here's how it starts, for me: ...") |
| Colloquialisms | none | "a whole lot", "push around" in a caveat | "the shiny stuff", "steaming along", "walks out the door", "Sure, ...", "for real, like actually" |
| Bold | none | none | run-in labels for an enumerated series inside a paragraph (**theory 1: Independent Trials (Engineer view).**) |
| Lists | inline enumeration | one list of full-sentence takeaways | short list of full-sentence imperatives to close ("Measure multiple times. Measure across situations. ...") |
| "actually" | absent | rare | a genuine feature ("what is actually going on"; "I guess it still does, actually") |

**Declaring scope.** Each project states, in its own `CLAUDE.md`, which files this guide
governs and where each sits on the dial. Copy this block and edit it:

```markdown
## Voice

Load `~/.claude/guides/voice.md` before writing reader-facing prose. In this project:

- <the main prose files>: **commentary, leaning conversational.**
- <captions, or strings a program emits>: **commentary.** Read out of context, so a
  notch more formal: no "I", no anecdote, contractions sparingly.
- README and landing pages: **conversational.**
- Anything destined for a manuscript: **paper**, with §1–5 read in the paper column.
```

Typical assignments, as a starting point: analysis reports and supplements sit at commentary
leaning conversational — "we" for the analysis and its decisions, "you, the reader" in reading
instructions ("what you should look for in the lower panel"), "I" about once per document for
a judgment that is plainly one person's. Strings emitted by code are read out of context and
stay a notch more formal. Public site copy sits fully conversational.

**Calibration quotes**, three per register, so the dial has fixed points.

*Paper.*

> "Higher ICCs reflect higher test-retest reliability in BOLD signal across participants
> (i.e., a participant with high BOLD signal in a particular region in a particular session
> is also likely to have high BOLD signal in that parcel on other sessions, relative to
> others in the sample)."

> "These main effects, while quite precise, were also somewhat small, and are set against a
> backdrop of substantial unexplained between- and within-person variation."

> "As such, we view the estimates of internal consistency as upper bounds ..."

*Commentary.*

> "If this sounds a little bit difficult, it's because, like many things in software
> development, it is. There's no free lunch; and there are no solutions, only tradeoffs."

> "It would be more appropriate to say that ..."; "Such a discussion would acknowledge
> that ..."

> "The trends here are so close to zero that slightly negative is not so different from
> slightly positive."

*Conversational.*

> "I'm a methodologist not by training, but by choice and love."

> "There's some math in it, and some history. It's a dense and rich text, but it's written
> clearly. Reading papers like this is a bit like reading poetry. You don't have to fully
> understand it the first time you read it. It rewards rereading."

> "This can certainly be a reasonable way of thinking and it's what makes Bayesian updating
> so powerful. If you flipped heads 25 times in a row, you'd likely conclude the coin isn't
> fair—regardless of what you believed going in. What's crucial about this frame of mind,
> though, is that your model has to be right, and you have to have enough data."

> (footnote) "A fancy word for 'communicating an appropriate amount of uncertainty so
> you're making mistakes about as often as you think you should be.'"

**What does not move along the dial.** The hedging engine (§3), the paragraph shape
(§1), the "i.e." gloss, the numbers conventions (§4), nulls described rather than
dismissed, positions stated flatly and then bounded, concede-then-critique, and the reader
named as the beneficiary. The most conversational piece still hedges three times in one
clause: "one mechanism that might contribute in some places, sometimes, to this
phenomenon." That is the constant.

## 1. The shape of the prose

**Sentences are long and accretive, with a short core.** The default sentence is 25–45
words: a plain main clause, then qualifiers bolted on with participial phrases, "though /
although / while", "i.e." glosses, and parentheticals. In the paper register short sentences
are rare and used as a punch after a long build-up, never in runs. In the conversational
register they are more common and can run ("There's some math in it, and some history. It's
a dense and rich text, but it's written clearly."), and the reports may borrow that where a
section wants a landing; the tell is a whole paragraph of them, which reads as a slide deck.

> "These main effects, while quite precise, were also somewhat small, and are set against a
> backdrop of substantial unexplained between- and within-person variation."

> "Sure, it went fine last time, but that doesn't mean it's not going to fail next time."

**Parentheses are the primary tool; em-dashes are secondary.** Parentheticals carry
precision glosses "(a Type 1 error)", concessions "(conditional on certain assumptions)",
"(but note that ...)", "(as always, with caveats, but that's for another time)",
enumerations "(i) ... (ii) ...", and citations. Em-dashes are for a genuine appositive
("cycle time—a widely-used metric measuring time from ticket creation to completion—") or,
in the conversational register, an interruption that carries the point ("crucial
infrastructure—and its risks—invisible until it fails"). Budget: about one per thousand
words in a paper, two or three in the reports. The reports as of Aug 2026 run ~8 per
thousand; most should become parentheses, commas, or semicolons. Semicolons chain parallel
items that have internal commas; colons introduce an enumeration, a quoted passage, or a
restatement.

**"i.e." over "e.g."** in his own voice: the instinct is to restate precisely, not to give
an instance. (Self-description is the exception; see §6a.) Definitions are given twice, once formally and once as an "i.e." in plain
language about a participant, a voxel, or a scan. In the conversational register the second
statement can be a footnote.

> "Higher ICCs reflect higher test-retest reliability in BOLD signal across participants
> (i.e., a participant with high BOLD signal in a particular region in a particular session
> is also likely to have high BOLD signal in that parcel on other sessions, relative to
> others in the sample)."

**Paragraphs: claim → worked example or numbers → consequence.** The opening sentence states
the claim (often "The X of Y is Z" or "Another issue is ..."); the middle does the work with
an enumerated case, an arithmetic check, or the estimates; the last sentence draws the
consequence ("This leads to ...", "In effect, ...", "In other words, ...", "This suggests,
at least, that ..."). Sections close with an "Overall, ..." or "Generally, ..." synthesis; in
the conversational register that becomes "To wrap up, ..." or "So to fulfill the promise of
the title, ...". Sections open with a roadmap sentence when there is more than one thing to
cover ("I will outline two critiques of Study 2. First, ... Second, ..."; "This is a sort of
parable about infrastructure, risk, and why certain things are hidden from view until
suddenly they're not.").

**Arguments are made in prose; lists are for parallel items.** In the papers, enumeration
is inline ("(i) ... (ii) ...", "First, ... Second, ... Finally, ...") and there is exactly
one bulleted section (a "take-aways for practitioners" list, each bullet two to four full
sentences carrying a claim and its caveat). The conversational pieces close with a short list
of full-sentence imperatives, and label an enumerated series inside a paragraph with bold
run-in headings. **Reports are a different genre**, and John wants them to keep the
structure that makes them easy to navigate: lists, callouts, tables, and headings are
welcome when they carry parallel items or pull a caveat out of the flow (see §6). The tell
is not the list; it is the list *in place of the reasoning*: a chain of fragments where the
reader has to reconstruct the argument, or a bold label doing the work a sentence should do.
A list of four contrasts and their winners is structure; a list of "Key Questions" is a
tell.

**The reader is named as the beneficiary, and in the reports may be addressed.** "allows
the reader to verify", "leaves the reader unable to ...", "we try to give the reader a sense
of ..."; and, conversationally, "you'll be able to evaluate the justification for doing so",
"This is probably a familiar story to many of you." Signposting is written for someone
checking the work, not someone being sold it. What stays out is "you" as the owner of the
data ("Your fMRI dataset exhibits ..."), which is explainer voice, not address.

**Footnotes** (Quarto `^[...]`) are available in the reports for a real aside: the wry gloss,
the concession that would clutter the sentence, the pointer to further reading. Sometimes,
not routinely. A parenthetical that the sentence needs in order to be read correctly stays a
parenthetical; a footnote is for what the reader can skip without losing the argument. Three
patterns from the source: a plain-language definition of a term just used ("A fancy word
for ..."); a self-aware caveat on a list of demands ("I know, we can't all do all of these
things all of the time. But these things should be on our mind."); and a citation with one
sentence on why it is worth the reader's time.

## 2. Person and stance

- **"We"** for the analyst and for methodological decisions, including interpretive acts
  ("We interpret these patterns to suggest ...", "we view the estimates ... as upper
  bounds", "We decide to interpret and display ..."). **"I"** in sole-authored commentary,
  and in the reports for a judgment that is plainly one person's or for an aside, about
  once per report; not in captions or renderer strings. Passive is fine for pipeline steps
  ("Preprocessing was performed ..."). **"You"** addresses the reader as a colleague
  looking at the same figure ("what you should look for", "if you want to trace a point
  back to its specification"); never as the owner of the data.
- **Positions are stated flatly and immediately bounded** with the condition under which
  they hold. He does not declare victory; he names which theory a result does or does not
  sit well with. Conversationally the flat statement can be quite flat ("The article is not
  an account of who was right and who was wrong, though. I don't think any respectable
  account would reduce the complexity to such an extent.").
- **Critique is generous in framing and unsparing in content**: concede what is good, state
  the problem in one plain sentence, then write out what the appropriate statement *would*
  be ("It would be more appropriate to say that ..."; "Such a discussion would acknowledge
  that ..."; "This can certainly be a reasonable way of thinking ... What's crucial about
  this frame of mind, though, is that your model has to be right"). No moralizing adverbs.
- **Wryness is dry and parenthetical or footnoted**, never a joke-shaped sentence: "(this
  can be an exercise left for the reader)", "(though the reader can probably guess)",
  "(i.e., assumes negative cycle-times are plausible!)", "(as always, with caveats, but
  that's for another time)". One or two per report.
- **Rhetorical self-question, then answer**, used to pivot: "But over the long run of what?
  Well, specifically over the long run of repetitions of the study procedures and analyses."
  "So to fulfill the promise of the title, how should you measure individual differences?"
- **Anecdote and feeling** belong to the conversational register only, and to openings.
  Reports do not need them; a README or a docs landing page may use one.

## 3. Hedging, nulls, and noise

**Hedge with modals and degree adverbs, stacked; never with discourse adverbs.** Workhorses:
*may, might, seems to / does not seem to, likely, plausibly, somewhat, fairly, quite, rather,
very small, close to zero, essentially, in part, at least, roughly, about, tend to, perhaps,
sometimes, in some places.* He stacks two or three ("somewhat more interesting", "very weak,
and possibly false-positives", "quite a few", "one mechanism that might contribute in some
places, sometimes, to this phenomenon", "perhaps reasonably"). Strong claims get "clearly",
"cannot", "impossible to know", "virtually none", "uniformly", and are reserved for logical
or definitional consequences and for what the data cannot support. Speculation is labeled
as such ("Although speculative, we think that ...") and then two or three competing
mechanisms are offered and ranked ("A more likely possibility ..."; "Another, perhaps
equally plausible, possibility ...").

**Certainty is expressed as probability, not adjective.** "with 97% of the posterior in this
direction", "with 71% of the posterior for the interaction having negative sign with a
fairly narrow distribution around zero (95% HDI = [-0.0005, 0.0002])".

**Null results are described, not dismissed, and are never "no effect".** State where the
posterior mass sits, whether the sign is even stable, and what would have been expected;
say what would license the stronger claim (power, an equivalence bound). Nulls are
"inconclusive" unless that has been shown. This matters here: most age effects in this
project are small, and the reports must not overstate absence any more than presence.

> "The trends here are so close to zero that slightly negative is not so different from
> slightly positive."

> "Without being able to show high power to detect nearly-inconsequential effects, these
> null results would be inconclusive (but note that preregistration and prepublication
> ensures they are unaffected by reporting or publication bias thereby increasing their
> usefulness in meta-analyses)."

**Noise is a finding, not an apology.** "set against a backdrop of substantial unexplained
between- and within-person variation"; "sometimes data can be too noisy to draw any credible
conclusions. That in itself is a signal you can use to improve how and what you measure."

**Reliability is not validity, and he says so.** Recurring measurement lens: reliable
variance vs uncertainty, within- vs between-person, attenuation, upper bounds ("As such, we
view the estimates of internal consistency as upper bounds ..."). "reflects" is his verb for
"is an index of".

**Sensitivity results get one flat sentence.** "Running the analyses without these three
subjects does not change the significance of any results." "Including socioeconomic status
in the above analyses did not substantively change the results."

## 4. Numbers and figures

- **Verdict first, numbers after a colon or in parentheses, verdict restated.**
  "ICCs for test-retest reliability were uniformly small in magnitude and close to zero:
  ranges and interquartile intervals (IQR) for median posterior ICCs were ICC = [.04, .15]
  (IQR .06-.08; N = 400) across parcels ... This pattern indicates that the test-retest
  reliability ... is uniformly low across the brain."
- **Formats.** Ranges as `[lo, hi]`; IQR and N inside the same parenthetical; no leading zero
  for bounded quantities (.44, r = .11), leading zero otherwise; "median posterior",
  "95% credible interval", "95% CI = [.43, .45]"; ΔAIC, ΔELPD with SE and the decision rule
  stated once; variance shares as fractions in words ("about half", "two-thirds", "virtually
  none") when interpreting, as numbers when reporting.
- **Work the arithmetic in the prose** when it carries the argument: "1 − .95^5 = .23", "In
  total, this is eight models."; "we reduce cycle time by roughly 2 days (compared to a raw
  median of 13 days; Figure 8)". Translate coefficients into units the reader has.
- **Figures and tables are cited in trailing parentheses** "(Fig. 7B; Table S6)", "(see
  Fig. 1 and Methods for details)", never introduced with "The figure below shows ...". A
  caption is a declarative sentence stating the finding, then the mechanics ("Figure 4: More
  merged PRs is associated with shorter cycle times."). Prose that accompanies a figure says
  what to look for and why, then reads it; it does not re-describe the axes unless the
  encoding is unusual.
- **Model descriptions follow a fixed order**: the estimand → the software → the term-by-term
  gloss (in words and, where useful, the mgcv/brms formula) → what the derived quantity
  reflects → why this estimator over the alternative → a one-sentence conceptual restatement.
  "Bayesian estimation was chosen primarily because it allows straightforward computation of
  credible intervals of the quantities of interest."

## 5. Vocabulary

**Spelling is American** (behavior, color, modeling, gray, analyzed, labeled, centered,
summarize, penalized), as in every source piece; the lint's `brit` column counts the
British forms and should be zero.

**Characteristic (use freely):** reflect(s), within-person / between-person, constrain(ed),
verify / verifiable, appropriate (uncertainty), a box to be checked, warranted, tentative, generative, plausible / plausibly, credible,
posterior, probability mass, precise but small, unexplained variation, heterogeneity,
attenuate, upper bound, conditional on, all else equal, disaggregate, partition variance,
straightforward(ly), thereby, in effect, in other words, that is, note that / note well,
of course, indeed, quite, fairly, somewhat, roughly, at least, as such, with respect to /
with regard to, the reader, sensible pattern, coherent, reassuring, defensible, principled,
push around, a whole lot / a little bit, a bit like, sure (as a concession opener), case
closed, for real (conversational only), actually (conversational; a couple per report at
most, and never as "the actual number" filler in a caption).

**Present but sparing (≤ once per report):** importantly, notably, robust (technical sense
preferred: Type-1-controlled, robust regression; he does use it as filler in the
conversational pieces, so one is tolerable), taken together, striking, crucial (only for
the load-bearing methodological point; the conversational pieces use it more, the reports
should not), shocking (once, in a commentary, for a real gap in a literature).

**Absent (do not use):** leverage, delve, key finding(s) / key insight / key questions,
nuanced, comprehensive, underscore, shed light, pave the way, plays a role, landscape,
framework (as filler), highlight (as self-promotion), novel, exciting, remarkable,
utilize, critical (as "important"), headline, honest (as in "the honest summary"),
deliberately / by construction / on purpose as self-justification, "Welcome!",
"here's what you need to know", "think of it as", "light up", "at a glance",
"executive summary", "bottom line", "takeaway". ("Here's how it starts" as a
conversational opener is fine; "here's what you need to know" is not: the first is
narrative, the second is a slide title.)

## 6. Register: what a report may do that a paper may not

Taking a report at commentary-leaning-conversational (§0) as the worked case:

| | Paper | Report |
|---|---|---|
| Person | we; passive for procedure | we; passive for procedure; "you" for the reader looking at the figure; "I" about once, for a judgment or aside |
| Contractions | none | freely |
| Colloquialisms | none | in a caveat or aside: "a whole lot", "push around", "sure, ...", "the shiny stuff" register, a few per report |
| Short sentences | rare, one at a time | allowed as a landing after a long build-up; a run of two is the ceiling |
| Wry asides | one per paper, parenthetical | one or two per report, parenthetical or footnoted |
| Footnotes | citations only | occasionally, for a skippable aside (gloss, concession, further reading); a parenthetical the sentence needs stays inline |
| Em-dashes | ~1 / 1000 words | ~2–3 / 1000 words |
| Bold | none | run-in labels for an enumerated series inside a paragraph, and nothing else; no `**Label:**` bullets |
| Code font | none | for actual identifiers only: file names, column names, model formulas (`s(age, parcel_f, bs="fs")`), function names. Not for concepts, not for emphasis |
| Lists | inline enumeration only | fine, and encouraged, for parallel items the reader will scan (contrasts and their winners, targets and their edf, a set of caveats, a procedure, closing imperatives). Each item is a full sentence or a complete clause. Not for the argument itself: a result and its interpretation are a paragraph |
| Callouts | n/a | fine, and encouraged, for a reading instruction ("what to read off the plots"), a caveat that changes how a figure is read, or a provenance warning; a short title inside is fine. Content is prose or a list of full sentences. Not for decoration or for the main result |
| Tables | for estimates | same, plus for anything the reader will look up rather than read (model definitions, per-cell winners, data dictionaries) |
| Headings | short noun phrases, sentence case | same, and more of them is fine (the reports are navigated, not read front to back); no "Executive Summary", "Overview", "Key ...", "Interpretation", "Summary" boilerplate; no question headings; no Title Case |
| Opening | abstract | one paragraph: the question in a sentence, the approach in a sentence, the answer in two, a roadmap sentence. May start from the reader's situation ("If you have opened this report to find out whether ...") |
| Closing | conclusion widening the frame, refusing to oversell | an "Overall, ..." / "To wrap up, ..." paragraph that restates two or three findings at the level the evidence supports; caveats may follow as a short list or a callout |

Captions and renderer strings stay a notch more formal than the table's report column: no
"I", no anecdote, contractions sparingly.

### 6a. Self-description: bios, site intros, about pages

Drawn from one round of John's own edits to the front page of his site (2026-10-10), so
treat this as a first data point rather than settled rules. It sits at **conversational**.

- **Accuracy over polish, and no inflating the role.** Every claim about past work should
  trace to something checkable (a CRediT statement, a methods section, a repository).
  "Measured" or "evaluated" is a different claim from "built and validated"; say the one that
  happened. Scope past work with a plain hedge ("has primarily worked on", "has spanned").
- **Make the abstract thread concrete with people.** He turned "the thread is well-being"
  into clauses that each name who and what: "For me, the common thread is well-being: how
  young people develop and thrive, how people fare under stress, how patients respond in
  care, and how things get done at work." The last clause stays true to what the work-side
  research measured instead of stretching it into a well-being claim.
- **Describe a place by its kind when the name adds nothing for the reader**: "program
  evaluation at a regional nonprofit", not the organization's name.
- **Name capabilities directly, then give instances.** "the ability to create durable,
  reproducible tools when they don't already exist (e.g., containers or packages)"; "leads
  me to ask things like what a number actually measures, and what causal story our analysis
  can actually tell." In self-description "e.g." and "things like" are fine; the "i.e. over
  e.g." rule in §1 is about restating a technical term, not listing what someone does.
- **Uncertainty is "appropriate", not "honest"**: "with appropriate uncertainty carried
  through from the measurement to the conclusions", which matches the calibration footnote
  in §0 ("communicating an appropriate amount of uncertainty").
- **Plain words for a methodological stance**: "construct validity as a starting point in
  the work rather than a box to be checked"; "what causal story our analysis can actually
  tell" rather than a formal statement of identification assumptions.

## 7. Tells to scrub

The counts below come from a sweep of one real research-report repository (Aug 2026), kept
because the *proportions* are the useful part — this is what a drafted-then-neglected corpus
looks like. The older files (the model-comparison, diagnostics, data-check and demo
reports) carry the bullet/bold/Title-Case tells; the newer files are paragraph-heavy but
carry the em-dash / italic-aside / self-justification tells and need only a light pass.

1. **Bold lead-ins**: 226 bullet lines and 110 paragraph openers of the form `**Label:**`
   / `**Label** —`; 494 bold spans in prose. Bold in body prose should be zero except for
   run-in labels of an enumerated series ("**Theory 1: independent trials.** ...").
2. **Bullets where the argument belongs**: 465 bullet lines vs 516 paragraphs overall; ratios
   above 1 in six files, the worst at 5.5. The count is
   a symptom, not the target: lists of parallel items stay lists (see §6); what changes is
   a result-plus-interpretation chopped into fragments, or a numbered "1. AIC reflects...
   2. ΔDev reflects... 3. In our data..." explanation, which becomes a paragraph.
3. **Boilerplate headings**: "Executive Summary" ×5, "Overview" ×10, "*Summary*" ×22,
   "Interpretation" ×3, question headings ×3, Title Case ×50, `---` rules ×24.
4. **Figure restatement**: "This report/section/document + verb" openers ×24; "table below"
   ×7, "below shows" ×4, "The following brain map shows ...".
5. **Em-dashes** ×206 (~8 per 1000 words; target 2–3), italic asides ×192, arrows `→` ×25
   (16 in one file), `✓` ×3.
6. **Self-justification vocabulary**: "by construction", "deliberately", "on purpose",
   "honest", "this is why / which is why" ×15. ("actually" and "here's" are no longer
   counted as tells; see §5.)
7. **Explainer register**: "light up", "recipe book", "think of them as tiny measurement
   points", "**Welcome!**", second-person "your data" (as opposed to "you" the reader,
   which is fine).
8. **Filler**: "robust" ×24 (mostly filler), "key" ×21, "critical" ×5, "comprehensive" ×2,
   "headline" ×9, "framework" ×6.
9. **Strings emitted by code** — caption builders, model-description helpers, any function
   that renders prose into a document. Same bold-lead-in captions and sentence-fragment
   descriptions, and they reach every document the code produces, so they need rewriting too.
   Check the test suite for string assertions before editing them.

A lint script, if the project has one, counts these tells per file so a rewrite can be checked
programmatically rather than by eye. Read the `bullet` column as information, not a target:
a report full of parallel lists can be fine. The columns that should go to zero are `bold`,
`boiler`, `absent`, and `selfj`; `emdash` should fall to two or three per thousand words
(`words_per_emdash` ≥ ~350); and `casual` (contractions, "you", "actually") is
informational, there to confirm the register moved rather than to be minimized. Run the
lint after the rewrite; "looked fine" is not a check.

### 7a. Tells in client-facing report prose, and the fix

Collected from live edits to drafted client-facing report prose across projects (2026-09).
The two root habits are the first two; most of the rest are cases of them.

1. **Agency for things that have none.** Tables, reports, sections, figures, models, scores
   and groups do not act. Tables don't give; people give. They show, contain, list or
   include; they do not give, tell, say, explain, ask, answer, argue, carry, see, know,
   decide or want. A person (I) describes, examines and recommends.
   - "The first table gives the results" → "The first table shows the results"
   - "the model decides which items count from their true starting value" → "whether an
     item counts depends on its true starting value"
   - "This section describes the data" → "In this section I describe the data"
2. **Motion and action verbs for states.** "accounts that came in above the cutoff" →
   "accounts that were above the cutoff at the start"; "the shares run somewhat
   higher" → "the shares are somewhat higher".
3. **Coined shorthand labels.** Do not compress a group or a quantity into a hyphenated
   label invented for the occasion ("late-joiners", "the month-3 row"). Write out
   what it is each time, even when that is longer. Internal code, file and cache names
   never appear in client prose.
4. **Spatial or quantity metaphors for credibility.** "how far to trust it" (you don't
   trust things by length), "can be trusted", "how much weight to put on" → name the
   property directly: "its limitations", "how precise each one is", "are correct".
5. **Aphorisms and abstract-noun-swap closers.** A punchy closing line ("X is a starting
   point, not a verdict") reads as a slogan, not an analyst's sentence, and an abstract
   noun standing in for an action ("would replace inference with a record") hides what is
   actually being asked for. State the concrete claim, and the concrete ask, instead.
6. **Main claim first, condition after.** "where comparable programs publish a number, the
   client's is consistent with theirs" → "the client's number is consistent with the
   published literature where a comparable number exists." Name the source plainly rather
   than paraphrasing what it says.
7. **Bare imperatives at the reader.** Frame guidance with its context and reason, and make
   it conditional on the reader's own judgment where the choice is theirs to make, rather
   than issuing a command. Do not recommend reinstating a practice the client dropped
   without knowing why they dropped it; recommend the underlying need instead.
8. **Overclaiming verbs.** "show whether X…" → "help understand whether X…"; "we should
   trust Y" → "based on the analysis and the literature, there is evidence Y is reliable".
9. **Vague sweeps, doublets and pronouns.** Name the referent instead of a pronoun or a
   vague sweep ("whenever and however" → state the specific condition); cut clipped
   trailing phrases that add no information ("a single jump between two" → "a single jump").
10. **Describe the artifact, not the modeling choice, and gloss it.** State what a modeled
    structure IS in plain terms, grounded in the literature or design that motivates it,
    then restate it once in plain language for a non-technical reader.
11. **No internal correction history in client-facing prose.** Past fixes, refits and
    discoveries stay in internal docs and memory; client text states the current method and
    the recommendation. A data-quality problem the client must act on themselves is not
    history, and stays.
12. **Report what the client told you as their own practice, not as something the analysis
    discovered.** If the client stated a fact about their own process, say that they stated
    it, then describe what the data show about it — don't frame their own report as an open
    question the analysis happened to answer.
13. **"This rather than that" contrast tails.** A redundant "X, not Y" or "rather than"
    construction adds nothing once the positive claim is stated. "can build on an existing
    design rather than having to create one" → "can build on an existing design." State the
    positive claim alone; cut the contrast.
14. **Em-dash typography.** Typed closed as `---` in markdown prose (renders as an
    em-dash), never a spaced " — ".

## 8. Before / after

The "before" text is adapted from real drafted reports: the habits are kept exactly, but the
study, variables, file names and numbers are changed, so the running example is a fictional
longitudinal study of children's reading scores across subtests, with student, session and
passage random effects. The "after" is how the same content should read. Numbers in the
after-versions are carried over from the before-versions and are illustrative throughout.

**8a. A selection rule (a model-comparison report)**

Before:

> **Selection Criterion:** We use **Akaike Information Criterion (AIC)** to select the best
> model for each subtest. Lower AIC indicates better model fit after
> penalizing for model complexity. **Important:** A more complex model is considered
> meaningfully better only when ΔAIC > 2. AIC differences < 2 indicate essentially
> equivalent models.

After:

> Models are compared within each subtest by AIC. A more complex model is preferred
> only when its AIC is lower than the null's by more than 2; smaller differences are treated
> as equivalent and the simpler model is retained. Note that this rule selects the model that
> predicts best under the complexity penalty, not the model whose age effect is largest, so a
> winning model may still describe a very small effect (a point taken up in the effect-size
> section below).

**8b. An "apparent paradox" explainer (the same report, further on)**

Before:

> In mixed-effects models with large sample sizes, you may notice cases where ΔAIC (vs Null)
> is large (e.g., +50, indicating very strong evidence for the winning model) but ΔDev. is
> small (e.g., < 1%, indicating minimal variance explained). This apparent paradox occurs
> because:
> 1. **AIC** reflects improvement in the statistical likelihood, which compounds with sample
>    size n. With n ≈ 20,000+ observations (weighted), even tiny fixed-effect improvements
>    create large ΔAIC
> 2. **ΔDev.** reflects the marginal variance explained by the fixed effect relative to a
>    null model that already includes random effects
> 3. In our data, random effects (student, session, passage) dominate the variance, so fixed
>    effects explain modest percentages even when they are highly significant
>
> Both metrics are correct. A large ΔAIC with a small ΔDev. means the effect is **real,
> well-estimated, and statistically significant** — but it explains only a small additional
> fraction of variance beyond what the random effects already capture.

After:

> With samples of this size, ΔAIC and deviance explained will disagree, and it is worth being
> clear about why before reading either column. AIC is a function of the likelihood, and the
> likelihood compounds with n; at roughly 20,000 weighted observations a fixed effect that
> shifts each prediction very slightly can still improve the log-likelihood by tens of units,
> so a ΔAIC of 50 against the null is not unusual for an effect a plot would show as nearly
> flat. Deviance explained asks a different question: how much of the residual variance, after
> the student, session, and passage random effects have already been credited, does the age
> term account for. Because those random effects carry most of the variance in these data, the
> answer is generally under one percent even for terms the AIC strongly prefers. Neither number
> is wrong. Read together, a large ΔAIC with a small ΔDev says that the age effect is well
> identified (i.e., its sign and rough shape are not in doubt) and also that it is small
> relative to how much students, sessions, and passages differ from one another; which of
> those two facts matters more depends on the question being asked.

**8c. Introducing a figure (a specification-curve report)**

Before:

> Each plot below shows the results of model comparison across multiple analysis
> specifications (combinations of examiner covariate sets and variance weighting) for a
> single subtest.
>
> **Top panel — AIC differences:** The y-axis shows each model's ΔAIC relative to the null
> model (null − model AIC). A larger positive value means that model has a *smaller* (better)
> AIC than the null by that amount. The null model always sits at 0 on the y-axis. Points are
> ordered along the x-axis by magnitude, with each x-position representing one specification.
> Color indicates which model the point belongs to.
>
> **Decision rule:** We use a threshold of ΔAIC > 2 (red dashed line) to decide whether a
> model is meaningfully better than the null. Among models that exceed this threshold for a
> given specification, we select the one with the smallest AIC (largest ΔAIC). If no model
> exceeds the threshold, we retain the null.

After:

> Each panel plots one subtest's model comparison across the specifications (i.e., every
> combination of examiner-covariate set and weighting). In the upper panel each point is
> one model under one specification, placed at its ΔAIC relative to the null (null minus
> model, so larger is better and the null sits at zero) and ordered along the x-axis by that
> value; color marks the model. The dashed line at ΔAIC = 2 is the decision threshold: for a
> given specification we take the model with the largest ΔAIC among those clearing it, and
> retain the null when none does. The lower panel is the specification grid, which shows for
> each x-position which covariate set and weighting produced the point above it, so any point
> can be traced back to its specification. What to look for is whether the winning model, and
> the size of its ΔAIC, hold across the grid or depend on a particular corner of it.

**8d. A report opening (a diagnostics report)**

Before:

> This report examines what predicts the per-score standard error (SE) across all
> subtests. Understanding these relationships is critical because **the SE is used
> for weighting** in model fitting (1/SE² weights) — if the SE is systematically related
> to variables of interest (age, years of schooling, sex), weighting could introduce bias.
>
> We focus on four key predictors: **Age**, **|Score|** (absolute score magnitude),
> **Schooling**, and **Sex**. Signed score is included as supplementary context.
>
> - We use **log(SE)** throughout due to the heavily right-skewed distribution of raw
>   SE values.
> - We use **Spearman (rank-order) correlations** because the distribution of the SE is
>   non-normal even after log transformation.

After:

> Model weights are the inverse of each score's squared standard error, so anything that
> predicts the SE also shapes the weights. If the SE varies systematically with age,
> schooling, or sex, weighting would upweight some parts of the age range over others, and
> the age estimates could be biased as a result. This report asks whether that is the case,
> treating age, absolute score, years of schooling, and sex as predictors of the SE across
> all subtests (signed score is reported alongside for context). The SE is analyzed on the
> log scale, because the raw distribution is heavily right-skewed, and associations are
> Spearman correlations, because the distribution remains non-normal after the transform.

**8e. A summary written as a spec sheet (a measurement-variability report)**

Before:

> Your dataset exhibits characteristics of **Mechanism 2: High Variance**.
>
> **Evidence**:
> 1. **High measurement variability**: Large differences between Form A and Form B
>    within the same subtest
> 2. **High SE heterogeneity**: Measurement uncertainty varies dramatically across
>    observations (SD >> mean)
> 3. **Low test-retest reliability**: From existing ICC analysis, within-session reliability
>    is very low
> 4. **Low within-occasion consistency**: Different passages show inconsistent scores
>
> ### Implications
> Like the high-variance personality survey:
> - **Individual items are unreliable**: Each passage is noisy and imprecise
> - **But means can be measured**: Aggregating across passages or pooling forms can improve
>   reliability
> - **Test-retest remains challenging**: Even with aggregation, person effects are small
>   relative to noise

After:

> Taken together, the diagnostics point to high measurement variance rather than to an
> absence of true signal. Within the same subtest, the two parallel forms differ
> substantially; the SE is not merely large but heterogeneous, with a standard deviation well
> above its mean; within-session ICCs from the earlier reliability analysis are very low; and
> different passages given on the same occasion do not agree with one another. The analogy is
> a personality scale whose items are individually noisy: no single passage is a precise
> measurement, and yet an aggregate over many of them (across passages, or across the two
> forms) can be, and that is the reason inverse-variance weighting and pooling are used
> throughout. What aggregation does not fix is the ratio of person variance to noise, so
> test-retest reliability should be expected to remain low even where within-occasion means
> are estimated well.

**8f. Caveats in a callout (a trajectory report)**

Before:

> ::: {.callout-note}
> ## Caveats
> - Trajectories are on the score (response) scale, sex-averaged, at a typical
>   (median-examiner) session; student/session/passage random effects excluded from the
>   population and by-subtest views.
> - Per-subtest and boundary excursions reflect sparse-data edge behavior of the GAM
>   smooths and should not be read as point estimates.
> - Exploratory pooled-subtest analysis (#41 decoding, #52 comprehension), not a
>   pre-registered confirmatory test.
> :::

After (callout and list kept; the items become sentences that say why):

> ::: {.callout-note}
> ## Caveats
> - The trajectories are on the response (score) scale, averaged over sex, at a
>   median-examiner session, with the student, session, and passage random effects set to
>   zero, so they describe the population and not any particular child.
> - Excursions at the age boundaries, and in the sparser per-subtest panels, reflect the
>   edge behavior of the smooths where data are thin and should not be read as estimates
>   of the trajectory there.
> - The pooled-subtest models are exploratory (issues #41 and #52); nothing here was
>   pre-registered, and the model comparisons should be read as descriptive rather than
>   confirmatory.
> :::

The structure was already right for a report; the change is that each item is a full
sentence carrying its reason.

**8g. Newer-stratum prose: light pass (an effect-size report)**

Before:

> It also has to be read as a pair, because age enters the smooth model through three terms,
> not one: a shared population curve `s(age)` and two sex-specific deviations, `s(age):sexF`
> and `s(age):sexM`. mgcv penalizes each separately, and in several cells the shared term is
> shrunk essentially to zero while the sex-specific terms carry the entire effect. Timed
> oral fluency is the clearest case — `s(age)` has edf 0.01 while the sex terms have 1.90
> and 2.30 — so quoting the population edf alone would describe that cell as flat when the
> model actually spent 4.2 df on age. The total is therefore the honest one-number summary;
> the population figure is reported alongside it because it is what the plotted
> sex-averaged trajectory follows.

After:

> The edf also has to be read as a pair, because age enters the smooth model through three
> terms rather than one: a shared population curve, `s(age)`, and two sex-specific
> deviations, `s(age):sexF` and `s(age):sexM`. mgcv penalizes each separately, and in
> several cells the shared term is shrunk essentially to zero while the sex-specific terms
> carry the entire effect. Timed oral fluency is the clearest case (`s(age)` has edf 0.01;
> the sex terms have 1.90 and 2.30), so quoting the population edf alone would describe that
> cell as flat when the model in fact spent 4.2 df on age. The total is the better
> one-number summary; the population figure is reported alongside it because it is what the
> plotted, sex-averaged trajectory follows.

The content was already right; the changes are the em-dashes to a parenthetical, "actually"
to "in fact", and dropping "honest".

**8h. A string emitted by code (a caption builder)**

Before:

> **M_null Winner**
>
> M_null (baseline) won for this subtest, indicating reading scores are stable across the
> grades. For reference, trajectories from other models are shown below (de-emphasized).

After:

> The null model was selected for this subtest: none of the age, schooling, or sex models
> improved on it by more than 2 AIC units, so there is no developmental trajectory to plot.
> The trajectories the competing models would have implied are shown below, de-emphasized,
> for reference only. Note that selecting the null does not establish that scores are
> stable across the grades; it establishes that any change is too small, relative to the
> between-person and between-session variance, for these models to prefer it over a constant.

**8i. A null result**

Before:

> No significant age effect was found in spelling.

After:

> In spelling the age term did not clear the AIC threshold on either form, and the
> amplitude posterior straddles zero (median 0.03 between-person SD, 95% CI [−0.09, 0.14]),
> so the data are consistent with no change and about equally consistent with a change of a
> tenth of a between-person SD in either direction; the result is inconclusive rather than
> null.

**8j. A report opening paragraph in place of an Executive Summary**

Before:

> This report analyzes developmental models of reading scores across the elementary years,
> comparing `r n_total_models` models: a null baseline model and `r n_competing_models - 1`
> competing models that test different combinations of age, schooling, and sex effects. We
> examine **`r n_subtests` subtests** across decoding and comprehension.
>
> **Key Questions:**
> - How do age-related changes in reading unfold across the elementary years?
> - Does years of schooling explain changes beyond chronological age?
> - Do boys and girls show different developmental trajectories?

After:

> This report asks how scores on each subtest change across the elementary years, whether
> years of schooling explains any of that change over and above age, and whether the
> trajectories differ by sex. For each of the `r n_subtests` subtests we fit a null model
> and `r n_competing_models - 1` competitors combining age, schooling, and sex terms, and
> select among them by AIC. In brief, age is preferred over the null in most subtests, the
> age effects are small relative to between-person differences (under one percent of the
> variance in every case), and schooling adds nothing over age once age is in the model. The
> sections below give the model definitions, the per-subtest winners, and the fitted
> trajectories, in that order.

**8k. The same passage at two positions on the dial**

The 8a "after" text is commentary register. The reports may go one notch further. Both are
acceptable; the second is closer to where the reports should sit.

Commentary:

> Models are compared within each subtest by AIC. A more complex model is preferred
> only when its AIC is lower than the null's by more than 2; smaller differences are treated
> as equivalent and the simpler model is retained. Note that this rule selects the model that
> predicts best under the complexity penalty, not the model whose age effect is largest, so a
> winning model may still describe a very small effect (a point taken up in the effect-size
> section below).

Report, leaning conversational:

> Models are compared within each subtest by AIC, and a more complex model wins only
> if it beats the null by more than 2; anything closer than that we call a tie and keep the
> simpler model. It's worth being clear about what the rule is and isn't doing. It picks the
> model that predicts best once you've paid for its complexity, not the model with the
> biggest age effect, so a winning model can still describe a very small one (the effect-size
> section below is where that gets taken up).

What changed: two contractions, "you" as the reader, one short sentence as a hinge, the
parenthetical kept. What did not: the rule is stated once and exactly, the caveat follows
the claim, nothing is declared.

**8l. A reading instruction that addresses the reader (the specification-curve report)**

Before:

> **Interpreting patterns across specifications:**
>
> - **Consistently above threshold:** When a model exceeds ΔAIC > 2 across all (remember,
>   any of them may be the "correct" specification), we can be confident that the result is
>   robust — it does not depend on particular choices about examiner covariates or weighting.
> - **Favored in some specifications but not others:** When a model clears the threshold in
>   some specifications but falls below it in others, the result is not robust. This
>   heterogeneity warrants investigation into *why* certain specifications favor the model
>   (e.g., a particular covariate set may absorb variance that the developmental model would
>   otherwise capture).
> - **Never above threshold:** When no model exceeds the threshold in any specification, we
>   can be more confident that our acceptance of the null model is not an artifact of a
>   particular analytic choice — the null is consistently preferred.

After:

> What you're looking for is whether the winning model, and the size of its ΔAIC, hold
> across the grid or depend on a particular corner of it. There are three patterns. If the
> same model clears the threshold under every specification (and remember that any one of
> them might be the right one), the result doesn't depend on how examiners were handled or
> whether the fits were weighted, and that is about as much reassurance as this analysis
> can give. If a model clears it under some specifications and not others, the result is
> conditional on an analytic choice, and the panel below the plot tells you which one; that
> is worth chasing, since a covariate set can absorb variance the age term would otherwise
> take up. And if nothing clears the threshold anywhere, keeping the null is not an
> artifact of one particular choice: it is what every specification says.

The three-way structure survives; it is carried by "three patterns" and "If ... If ... And
if ...", so the labels and the bullets are no longer needed. "Robust" (used three times
before) is gone; each case now says what it means instead.

**8m. A footnote carrying the aside**

Body text:

> The between-person SD is read from the subject random-effect variance component of the
> `m_age` fit, so it is a model quantity rather than a raw SD of the data.^[Which is to say
> it already has measurement noise and the age effect partialled out of it; a raw SD across
> participants would be larger, and would move with the age range in a way this one does
> not.]

The footnote holds the gloss that would otherwise have been an em-dash clause or a second
sentence starting "Note that". The body sentence stays a single claim.

**8n. Closing with imperatives (conversational; a README or a methods overview)**

> So, if you're going to reuse these models: read the winner and its ΔAIC together, never
> the winner alone. Treat "null wins" as "too small to prefer", not "flat". Check the
> specification grid before believing any single cell. And keep in mind that all of this
> is on the subtest-level scores, so anything upstream of that (item scoring, the exclusion
> roster) is fixed by construction of the release, not by these analyses.

## 9. Cognitive moves

Habits of mind visible in both the casual commentaries and the academic work. They are why the
casual writing reads as *substantive* rather than merely warm, so anything in this voice should
make one or two of them visibly — even on a light topic. Not every paragraph needs to perform a
between/within decomposition; the piece as a whole should show where the thinking is.

- **Distinguish the metric from the construct.** Name the popular quantity, then name the thing
  people *mean* when they reach for it, and refuse to let the first stand in silently for the
  second. Cycle time is "at best a very distal indicator of whatever it is people mean when they
  use the word 'productivity.'" Apply it whenever one number is asked to do conceptual work —
  it is almost always asked to do too much.
- **Decompose between versus within.** Stable differences between units and momentary variation
  within them are different phenomena, sometimes with opposite-signed effects, and conflating
  them is a default error worth naming. Faster typists make fewer errors *between* people; any
  given typist makes more errors *the faster they type*.
- **Stability is a summary of variation, not an intrinsic property.** When something looks
  settled, ask what variation that stability summarizes and what mechanism produces the
  regularity — a trait recast as a central tendency in a distribution of states, or an apparent
  success that was summarizing a drift in what counted as success.
- **Behavior is person × situation.** Even where individual differences are real and stable,
  expression is an interaction. Do not let an individual-differences account foreclose the
  situational one, or the reverse; mental models of risk can be role-induced rather than
  characterological.
- **Enumerate causal structures before committing.** When a correlation looks tidy, list the
  alternative DAGs that would produce it and ask what evidence separates them. The obvious story
  competes with reverse-direction and common-cause stories — a perk granted *because* low output
  was already expected, rather than causing it.
- **Watch the sociology of measurement.** Metrics live inside organizational incentives and
  role-shaped cognition. Adoption depends on whether the measured agree on what is measured and
  why, and mismeasurement can function as surveillance whether or not anyone intends it. In
  casual writing this surfaces as sensitivity to who benefits from a framing.
- **Quantitative without being scientistic.** Reach for the hierarchical model when it earns its
  place, but pair it with the philosophical or qualitative framing; numbers are not
  self-interpreting, and methods do not replace thinking about what is being measured.
- **Keep concrete examples close to abstract claims.** When the argument lifts, an example
  follows within a sentence or two — coin flips for Bayesian updating, typing speed for
  between/within, ice cream and drownings for a causal leap. Do not let an abstract point run
  three sentences unanchored.
- **State limits out loud.** Name what the work does not cover before any concluding move, and
  say it in the open rather than burying it.
- **Multi-causal humility about complex systems.** A sociotechnical system is "vastly more
  complicated than a two-sided probability machine" — a check on treating a well-modeled
  phenomenon as fully understood. Resist single-mechanism explanations where social,
  organizational and technical components all bear.

**In one line.** Write like a methodologist commenting on a piece of work for curious peers:
put yourself in the room, treat the target idea generously, name the methodological point the
surface story hides, refuse to let a single quantity stand in for the construct it is only
adjacent to, and close with a small concrete ask rather than a grand conclusion.

## 10. Checklist before committing prose

- The register is the one the document calls for (§0): reports commentary-leaning-
  conversational; captions and renderer strings a notch more formal; README conversational.
- No `**Label:**` lead-ins; no `**Key ...**`; bold only as a run-in label for a series.
- Lists carry parallel items in full sentences or clauses; the reasoning is in paragraphs.
  Callouts carry a reading instruction or a caveat, not the result.
- Em-dashes: two or three per ~1000 words at most; parentheses carry glosses and
  concessions; footnotes carry the asides.
- No heading called Executive Summary / Overview / Summary / Interpretation / Key ...; no
  question headings; sentence case throughout.
- Figures cited in trailing parentheses; the prose says what to look for (and may say it
  to "you"), not that the figure "shows" something.
- Every null is described (where the mass sits, what would license "no effect"), never
  declared.
- Every strong claim is immediately bounded by the condition under which it holds.
- Numbers: verdict, then estimate with interval and N in parentheses, then verdict restated.
- Vocabulary from §5 "Absent" list: zero occurrences. "actually", contractions, "you the
  reader": fine in body prose, absent from captions and code-emitted strings.
- §7a: no table, report, section, figure or model that gives, tells, explains, carries,
  answers or decides; no motion verbs for states; no coined hyphenated labels; no "how far
  to trust"; main claim before its condition; no internal correction history in
  client-facing text; no redundant "rather than" tails; the client's own stated practices
  attributed as theirs, not framed as a discovery; em-dashes typed as `---`, never spaced.
- If the project has a voice lint script: `bold`, `boiler`, `absent`, `selfj` at zero,
  `words_per_emdash` ≥ ~350, `casual` non-zero in body prose is expected.
