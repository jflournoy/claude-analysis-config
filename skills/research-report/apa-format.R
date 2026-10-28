# APA 7 number formatting for Quarto reports, so a write-up's numbers come from the model
# object and are never retyped. Base R only. Each function errors on input it cannot
# format honestly rather than printing something plausible.
#
# Copy into the project's R/ directory (or source() it from the report) and call inline:
#   *b* = `r apa_num(b)`, *p* `r apa_p(p)`, 95% CI `r apa_ci(lo, hi)`

.apa_check <- function(x, name) {
  if (!is.numeric(x) || length(x) != 1L) stop(name, " must be a single number, got ", deparse(x))
  if (is.na(x)) stop(name, " is NA; report it as missing instead of formatting it")
  invisible(x)
}

# Fixed decimals; two by default, which is APA's default for most statistics.
apa_num <- function(x, digits = 2L) {
  .apa_check(x, "x")
  formatC(x, format = "f", digits = digits)
}

# For statistics bounded by 1 (r, R², ICC, β of a correlation, η², α): no leading zero.
apa_unit <- function(x, digits = 2L) {
  .apa_check(x, "x")
  if (abs(x) > 1) stop("apa_unit() is for values bounded by 1; got ", x, ". Use apa_num().")
  sub("^(-?)0\\.", "\\1.", apa_num(x, digits))
}

# The relation and the value together, because "< .001" and "= .042" differ in both.
apa_p <- function(p) {
  .apa_check(p, "p")
  if (p < 0 || p > 1) stop("p must be in [0, 1]; got ", p)
  if (p < .001) return("< .001")
  if (p > .999) return("> .999")
  paste("=", apa_unit(p, 3L))
}

apa_ci <- function(lo, hi, digits = 2L) {
  .apa_check(lo, "lo")
  .apa_check(hi, "hi")
  if (lo > hi) stop("interval is reversed: lo = ", lo, " > hi = ", hi)
  sprintf("[%s, %s]", apa_num(lo, digits), apa_num(hi, digits))
}
