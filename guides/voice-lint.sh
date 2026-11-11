#!/usr/bin/env bash
# Count the voice tells listed in voice.md §7, so a rewrite can be checked rather than
# eyeballed.
#
# Usage: bash voice-lint.sh [--claude] FILE...
#   For .qmd and .md files, prose outside ```{...} chunks is scanned, plus the strings a
#   chunk prints onto the page; any other file is scanned whole.
#
# Output: one row per file with counts per tell, then a TOTAL row. The counts are a report,
# not a gate: exit 0 whatever they say, non-zero only when the lint itself could not run.
#
# Columns that should go to zero: bold, boiler, absent, selfj. emdash should fall to 2-3
# per 1000 words (words_per_emdash >= ~350). bullet is information. casual (contractions,
# "you", "actually") is information too: at the conversational end of the register dial
# (voice.md §0) a non-zero count is expected, and it should be ~0 only in paper-register
# prose, captions and strings a program prints. brit counts British spellings (colour,
# behaviour, modelling, grey, analysed...): target 0.
#
# WHAT THE COUNTS CANNOT SEE. Every column here is a regex over vocabulary and layout.
# The tells that actually make prose read as generated are structural: runs of short
# declaratives where the guide calls for long accretive sentences, X-not-Y constructions,
# rhetorical tricolons, telling the reader which of your own findings to care about,
# aphoristic closing lines, parallel-construction scaffolds running across paragraphs. A
# file can score zero on every column and still not sound like John. Pass --claude to have
# the model read the prose against voice.md and report those; it is opt-in because it
# costs a call per file and needs the CLI authenticated.
set -euo pipefail

usage() { echo "usage: bash voice-lint.sh [--claude] FILE..." >&2; }

USE_CLAUDE=0
args=()
for a in "$@"; do
  case "$a" in
    --claude) USE_CLAUDE=1 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "ERROR: unknown option $a" >&2; usage; exit 2 ;;
    *) args+=("$a") ;;
  esac
done
set -- "${args[@]+"${args[@]}"}"

if [ $# -eq 0 ]; then
  echo "ERROR: no files given." >&2
  usage
  exit 2
fi
for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: no such file: $f" >&2
    exit 2
  fi
done

# voice.md ships in the same guides directory as this script, globally or vendored.
VOICE_GUIDE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/voice.md"

# HTML comments are stripped as well as code chunks. A <!-- REVIEW: ... --> note
# is a message to whoever maintains the file, not prose a reader ever sees, and
# counting it produced "absent-list" hits that no reader could encounter.
# Multi-line comments are handled, not just single-line ones.
#
# Chunk-EMITTED strings are KEPT. A heading printed by cat(), a ggplot labs()
# title, a fig-cap: each of those lands on the rendered page and no reader can
# tell it from prose, but stripping chunks wholesale hid every one of them. That
# is how a report once scored zero while a cat() printed "**Interpretation:**" onto
# every page it rendered. Only the quoted literals from those
# calls are kept, with \n expanded so a cat()-ed "### Heading" still anchors at a
# line start for the heading patterns. Strings spanning a line break are missed.
prose_of() {
  case "$1" in
    *.qmd|*.md) awk '
        /^```/ { c = !c; next }
        !c     { print; next }
        {
          if ($0 !~ /cat\(|#\|[ \t]*(fig|tbl)-cap|(title|subtitle|caption|fig\.cap|tbl\.cap)[ \t]*=/) next
          line = $0
          if (line ~ /^[ \t]*#\|/ && line !~ /"/) { sub(/^[^:]*:[ \t]*/, "", line); print line; next }
          while (match(line, /"[^"]*"/)) {
            s = substr(line, RSTART + 1, RLENGTH - 2)
            gsub(/\\n/, "\n", s)
            print s
            line = substr(line, RSTART + RLENGTH)
          }
        }' "$1" |
                  awk '/<!--/{h=1} !h; /-->/{h=0}' ;;
    *) cat "$1" ;;
  esac
}

# Prose is hard-wrapped at ~78 characters, so a multi-word tell frequently
# straddles a line break: "...should see that at\na glance" is invisible to a
# line-oriented grep even though "at a glance" is on the scrub list, and that is
# exactly how one got through. Phrase patterns therefore run against a stream
# with each PARAGRAPH collapsed to one line; only the anchored patterns
# (headings, bullets) need real line starts.
flow_of() { awk 'BEGIN{RS="";FS="\n"}{gsub(/\n/," ");print}'; }

# Occurrences, not matching lines: a paragraph containing three tells is three.
count() { { grep -o -E "$@" || true; } | wc -l; }
count_lines() { grep -c -E "$@" || true; }

printf '%-45s %6s %6s %6s %6s %6s %6s %6s %6s %6s %6s %6s\n' \
  file words bold bullet emdash figref boiler absent selfj casual brit words_per_emdash

tot_words=0; tot_bold=0; tot_bullet=0; tot_emdash=0; tot_figref=0; tot_boiler=0; tot_absent=0; tot_selfj=0; tot_casual=0; tot_brit=0

for f in "$@"; do
  p="$(prose_of "$f")"
  q="$(printf '%s\n' "$p" | flow_of)"
  words=$(printf '%s\n' "$p" | wc -w)
  bold=$(printf '%s\n' "$p" | count -- '\*\*[^*]+\*\*')
  bullet=$(printf '%s\n' "$p" | count_lines -- '^\s*([-*+]|[0-9]+\.)\s+')
  emdash=$(printf '%s\n' "$q" | { grep -o -- '—' || true; } | wc -l)
  figref=$(printf '%s\n' "$q" | count -- '(This (report|section|document|figure|plot|map|table) (shows|presents|examines|describes|visualizes|demonstrates|provides|computes|uses|verifies))|((figure|plot|table|map|histograms?) below)|(below shows)|(shown above)|(The following .* shows)')
  boiler=$(printf '%s\n' "$p" | count_lines -- '^#+ .*(Executive Summary|Overview|Summary|Interpretation|Key |Takeaway|Bottom line|Headline)|^#+ .*\?$')
  absent=$(printf '%s\n' "$q" | count -i -- '\b(leverage[sd]?|delve|key (finding|insight|question|point|output|parameter)s?|nuanced|comprehensive|underscore[sd]?|shed(s|ding)? light|pave the way|plays? a role|landscape|utilize[sd]?|headline|takeaway|bottom line|executive summary|welcome!|here.s what|think of (it|them) as|light up|at a glance|critical(ly)? (for|because|to)|robust(ly|ness)?)\b')
  selfj=$(printf '%s\n' "$q" | count -i -- '\b(by construction|deliberately|on purpose|honest(ly)?|which is why|this is why)\b')
  casual=$(printf '%s\n' "$q" | { grep -o -i -E "\b(actually|you|your|yours|[a-z]+n't|it's|that's|there's|here's|what's|let's|we're|we've|we'll|you're|you'll|you've|i'm|i've|i'd)\b" || true; } | wc -l)
  brit=$(printf '%s\n' "$q" | { grep -o -i -E "\b(colou?rs?|colou?red|behaviou?r(al|s)?|modell(ing|ed)|greys?|analys(ed|ing)|labell(ed|ing)|centred?|summaris(e|ed|es|ing)|penalis(ed|es|ing)|favou?r(ed|s|able)?|(visuali|generali|minimi|maximi|standardi|normali|characteri|emphasi|organi|optimi|categori|recogni|stabili)s(e|ed|es|ing|ation)|artefacts?|whilst|amongst)\b" || true; } | { grep -i -E 'colour|behaviour|modell|grey|analys(ed|ing)|labell|centre|summaris|penalis|favour|is(e|ed|es|ing|ation)$|artefact|whilst|amongst' || true; } | wc -l)
  wpe=$([ "$emdash" -gt 0 ] && echo $((words / emdash)) || echo "-")
  printf '%-45s %6d %6d %6d %6d %6d %6d %6d %6d %6d %6d %6s\n' \
    "$(basename "$f")" "$words" "$bold" "$bullet" "$emdash" "$figref" "$boiler" "$absent" "$selfj" "$casual" "$brit" "$wpe"
  tot_words=$((tot_words+words)); tot_bold=$((tot_bold+bold)); tot_bullet=$((tot_bullet+bullet))
  tot_emdash=$((tot_emdash+emdash)); tot_figref=$((tot_figref+figref)); tot_boiler=$((tot_boiler+boiler))
  tot_absent=$((tot_absent+absent)); tot_selfj=$((tot_selfj+selfj)); tot_casual=$((tot_casual+casual)); tot_brit=$((tot_brit+brit))
done

wpe=$([ "$tot_emdash" -gt 0 ] && echo $((tot_words / tot_emdash)) || echo "-")
printf '%-45s %6d %6d %6d %6d %6d %6d %6d %6d %6d %6d %6s\n' \
  TOTAL "$tot_words" "$tot_bold" "$tot_bullet" "$tot_emdash" "$tot_figref" "$tot_boiler" "$tot_absent" "$tot_selfj" "$tot_casual" "$tot_brit" "$wpe"

# ---------------------------------------------------------------------------
# The read-for-rhythm pass the counts above cannot do.
# ---------------------------------------------------------------------------
if [ "$USE_CLAUDE" -eq 1 ]; then
  if ! command -v claude >/dev/null 2>&1; then
    echo "ERROR: --claude needs the claude CLI on PATH." >&2
    exit 1
  fi
  if [ ! -f "$VOICE_GUIDE" ]; then
    echo "ERROR: voice guide not found at $VOICE_GUIDE" >&2
    exit 1
  fi

  for f in "$@"; do
    echo ""
    echo "=============================================================="
    echo "Voice read: $f"
    echo "=============================================================="
    prose="$(prose_of "$f")"
    if [ -z "${prose//[[:space:]]/}" ]; then
      echo "  (no prose outside code chunks)"
      continue
    fi

    # The guide is the authority; the prompt only says which of its rules the
    # regex has already covered, so the model spends its attention elsewhere.
    {
      printf '%s\n' "Below is a voice guide, then prose from a document in that project."
      printf '%s\n' "Judge the prose against the guide and report ONLY concrete problems."
      printf '%s\n\n' ""
      printf '%s\n' "A regex lint already checks, so do NOT report these: bold runs, heading"
      printf '%s\n' "boilerplate and question headings, the section 5 absent-word list, the"
      printf '%s\n' "self-justification words, British spellings, em-dash density, bullets."
      printf '%s\n\n' ""
      printf '%s\n' "Look instead for what a regex cannot see:"
      printf '%s\n' " - runs of short declarative sentences where the guide asks for long"
      printf '%s\n' "   accretive ones with a short core and bolted-on qualifiers"
      printf '%s\n' " - X-not-Y constructions and rhetorical tricolons"
      printf '%s\n' " - telling the reader which findings are interesting or important"
      printf '%s\n' " - aphoristic or summarising final sentences"
      printf '%s\n' " - parallel scaffolds spanning paragraphs (it buys / it does not buy)"
      printf '%s\n' " - hedging that has been dropped where the guide wants it stacked"
      printf '%s\n' " - a null or absence described as nothing rather than as inconclusive"
      printf '%s\n' " - numbers stated as literals where they should be computed"
      printf '%s\n\n' ""
      printf '%s\n' "Output: at most 8 findings, each as one line -- the quoted phrase, then"
      printf '%s\n' "a dash, then what is wrong in under 15 words. Then one line: a suggested"
      printf '%s\n' "rewrite for the single worst one. If the prose reads correctly, say so in"
      printf '%s\n' "one line and stop. No preamble, no praise, no restating these rules."
      printf '%s\n\n' ""
      printf '%s\n' "===== VOICE GUIDE ====="
      cat "$VOICE_GUIDE"
      printf '%s\n\n' ""
      printf '%s\n' "===== PROSE FROM $f ====="
      printf '%s\n' "$prose"
    } | claude -p || {
      echo "ERROR: the claude call failed for $f; the counts above still stand." >&2
      exit 1
    }
  done
fi
