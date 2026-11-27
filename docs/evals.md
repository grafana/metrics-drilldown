# Assistant evals

Metrics Drilldown has no LLM of its own. Its AI surface is a handoff to the Grafana Assistant, so these evals cover
what **this repo** controls: what we send to the Assistant, and how we interpret what it sends back. They do **not**
grade the quality of the Assistant's answers.

The approach follows the [AI Evals FAQ](https://hamel.dev/blog/posts/evals-faq/): look at real failures first, label
cases pass/fail, prefer code assertions over LLM judges, and grow the case set from real failures.

## What is covered

| Surface                                         | Code                                                                                 | Eval                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| Assistant → Drilldown deep link                 | `src/extensions/links.ts` (`v0-alpha` target)                                        | `src/evals/assistant-links.eval.test.ts`   |
| "Explain in Assistant" prompt + context         | `buildExplainMetricPrompt` / `buildExplainMetricContext` in `OpenAssistantAction.ts` | `src/evals/assistant-prompts.eval.test.ts` |
| Quick-search `?` context + blank-question guard | `buildQuickSearchContext` / `openQuickSearchAssistant` in `QuickSearchAssistant.ts`  | `src/evals/assistant-prompts.eval.test.ts` |

They are ordinary Jest tests (`pnpm test:ci`), so they run in CI with no extra setup.

## Cases and failure modes

Cases live in `src/evals/cases/`. Every case has a unique `id`, a `failureMode` tag, and a binary expected outcome.
Failure modes are a small taxonomy, not a list of everything we can think of: add a mode only after you have seen
that class of failure for real.

## Known issues

A case with `knownIssue` is a defect that reproduces today. It runs under `it.failing`: CI stays green while the bug
exists and fails the day it is fixed, which is the cue to delete the flag. Currently:

- Filter values lose spaces (`parseMatcher` strips every space).
- Filter values lose every quote character, not only the wrapping ones.
- An unparseable filter emits a junk `var-filters=||` parameter.

## Adding a case

When an Assistant handoff misbehaves (a bad link, a missing context item, a user report), add a case that reproduces
it **before** fixing it. If it is a real defect, mark it `knownIssue`, then remove the flag in the fix PR.

## Telemetry for later error analysis

`explain_in_assistant_clicked` (flags only, never the query or metric name) and the existing
`quick_search_assistant_*` events give us volume and cohort data. Review sampled real interactions before inventing
new failure modes.

## Not covered

Assistant answer quality, multi-turn behavior, and end-to-end runs against a provisioned Assistant. These would need
trace capture and LLM judges validated against human labels (TPR/TNR); we deliberately do not build them until error
analysis shows they are needed.
