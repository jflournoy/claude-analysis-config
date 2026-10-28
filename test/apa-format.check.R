# Run by test/apa-format.test.js. Prints one line per failed expectation and exits 1 on any.
args <- commandArgs(trailingOnly = TRUE)
source(args[[1]])

failures <- character()
expect_equal <- function(actual, expected, label) {
  if (!identical(actual, expected)) {
    failures <<- c(failures, sprintf("%s: expected %s, got %s", label,
                                     deparse(expected), deparse(actual)))
  }
}
expect_error <- function(expr, pattern, label) {
  msg <- tryCatch({ force(expr); NULL }, error = function(e) conditionMessage(e))
  if (is.null(msg) || !grepl(pattern, msg)) {
    failures <<- c(failures, sprintf("%s: expected error matching '%s', got %s", label,
                                     pattern, if (is.null(msg)) "no error" else msg))
  }
}

expect_equal(apa_num(0.41872), "0.42", "num rounds to two")
expect_equal(apa_num(-0.1234), "-0.12", "num keeps sign")
expect_equal(apa_num(239, 0L), "239", "num digits")
expect_equal(apa_unit(0.5409), ".54", "unit drops zero")
expect_equal(apa_unit(-0.29), "-.29", "unit keeps sign")
expect_equal(apa_p(1.67e-12), "< .001", "p tiny")
expect_equal(apa_p(0), "< .001", "p zero is never = 0")
expect_equal(apa_p(0.198), "= .198", "p exact")
expect_equal(apa_p(0.0421), "= .042", "p three decimals")
expect_equal(apa_p(0.9999), "> .999", "p near one")
expect_equal(apa_ci(0.31464, 0.5228), "[0.31, 0.52]", "ci")
expect_error(apa_num(NA_real_), "NA", "num NA")
expect_error(apa_num("0.4"), "single number", "num string")
expect_error(apa_num(c(1, 2)), "single number", "num vector")
expect_error(apa_unit(1.2), "bounded by 1", "unit out of range")
expect_error(apa_p(1.5), "\\[0, 1\\]", "p out of range")
expect_error(apa_ci(0.5, 0.3), "reversed", "ci reversed")

if (length(failures)) {
  cat(failures, sep = "\n")
  quit(status = 1)
}
cat("ok\n")
