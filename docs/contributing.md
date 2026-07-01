# Contributing to Grafana Metrics Drilldown

Welcome! We're excited that you're interested in contributing. Below are some basic guidelines.

We love accepting contributions! To help us create a safe and positive community experience, we require all participants to adhere to the [Grafana Code of Conduct](https://github.com/grafana/grafana/blob/main/CODE_OF_CONDUCT.md).

If your change is minor, please feel free to submit a [pull request](https://help.github.com/articles/about-pull-requests/). If your change is larger, or adds a feature, please file an issue beforehand so that we can discuss the change. You're welcome to file an implementation pull request immediately as well, although we generally lean towards discussing the change and then reviewing the implementation separately.

## Filing issues
You are welcome to create draft PRs at any stage of readiness - this
can be helpful to ask for assistance or to develop an idea.
Before a piece of work is finished, it should:

- Be organised into one or more commits, each of which has a commit message that describes all changes made in that commit ('why' more than 'what' - we can read the diffs to see the code that changed).
- Each commit should build towards the whole - don't leave in back-tracks and mistakes that you later corrected.
- Have unit for new functionality or tests that would have caught the bug being fixed.

Use [GitHub Issues](https://github.com/grafana/metrics-drilldown/issues/new) to report bugs, ask questions, or propose larger changes.

| Situation | What to do |
|-----------|------------|
| **Bug** — something is broken or regressed | [Open a bug report](https://github.com/grafana/metrics-drilldown/issues/new?template=bug_report.md) with reproduction steps, expected vs actual behavior, Grafana/Prometheus versions, and screenshots or recordings if helpful. |
| **Small fix** — typo, clear one-file change, docs tweak | Open a pull request directly; link a related issue if one exists. |
| **Feature or larger change** — new UI, behavior change, refactor | [Open a feature request](https://github.com/grafana/metrics-drilldown/issues/new?template=feature_request.md) to discuss scope, or open a draft PR with context in the description. |
| **Documentation only** | Open a PR and add the `type/doc` label. |

For bugs, check [Prometheus](https://prometheus.io/docs/) and [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) behavior first — a metric missing outside the selected time window may be expected, not a plugin bug.

## Contribute to documentation

Have a great new feature you want to contribute? Add docs for it!
Find something missing in the docs? Update the docs!

Use the [Writer's Toolkit](https://grafana.com/docs/writers-toolkit/writing-guide/contribute-documentation/) for information on creating good documentation.
The toolkit also provides [document templates](https://github.com/grafana/writers-toolkit/tree/main/docs/static/templates) to help get started.

When you create a PR for documentation, add the `type/doc` label to identify the PR as contributing documentation.

To preview the documentation locally, run `make docs` from the `docs/` directory. This uses the `grafana/docs` image which internally uses Hugo to generate the static site. The site is available on `localhost:3002/docs/`.

> **Note** The `make docs` command uses a lot of memory. If it is crashing, make sure to increase the memory allocated to Docker and try again.

## Contribute code

### Development environment

**Requirements:**

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en) v22
- [Docker](https://www.docker.com/get-started/) or [OrbStack](https://orbstack.dev/download) (lighter alternative)

## Get started

1. Clone the repository: `git clone git@github.com:grafana/metrics-drilldown.git`
2. Install dependencies: `pnpm install --frozen-lockfile --ignore-scripts`
3. Start the dev build: `pnpm dev`
4. Start Grafana locally: `pnpm server` (Grafana at http://localhost:3001)

Then visit http://localhost:3001/a/grafana-metricsdrilldown-app/

See [AGENTS.md](../AGENTS.md) for architecture, Scenes patterns, and project conventions.

### Workflow

Grafana Metrics Drilldown follows a standard GitHub pull request workflow. If you're unfamiliar with this workflow, read the [Understanding the GitHub flow](https://guides.github.com/introduction/flow/) guide from GitHub.

You are welcome to create draft PRs at any stage of readiness. Before a piece of work is finished, it should:

- Be organised into one or more commits, each with a commit message that describes all changes made in that commit ('why' more than 'what').
- Each commit should build towards the whole — don't leave in back-tracks and mistakes that you later corrected.
- Include unit tests for new functionality or tests that would have caught the bug being fixed.

### Before you open a pull request

- Fill out the [pull request template](../.github/pull_request_template.md) with a clear summary and test steps.
- Use a [conventional commit](https://www.conventionalcommits.org/) style PR title (enforced by CI).
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci` locally.
- Add or update tests when behavior changes. Prefer focused unit tests (Jest) or Playwright E2E when UI flows are affected — see [E2E testing documentation](./end-to-end-testing.md).
- Follow the pattern established by the rest of the repo for code organization. Lint and format are enforced by ESLint, Prettier, and pre-commit hooks; you can also configure your IDE to run them on save.

### Internationalization (i18n)

User-facing strings must use Grafana i18n APIs — `t` or `Trans` from `@grafana/i18n` with a stable `i18nKey`, not hard-coded text in components.

After adding or changing copy:

1. Run `pnpm i18n-extract` to update `src/locales/en-US/grafana-metricsdrilldown-app.json`.
2. Commit the extracted English locale file with your PR.

CI runs an i18n verification workflow on pull requests. Translations for other locales are managed via Crowdin and synced after changes merge to `main`; you do not need to hand-edit non-English locale files in most PRs.

## Using AI and coding assistants

Generative AI tools can help you explore the codebase, draft code, and write documentation. **You are always responsible for what you submit.**

Read the full [Generative AI Contribution Policy](./genai.md) for acceptable use, disclosure, Metrics Drilldown-specific guidance (PromQL, Scenes, tests), and rules for agentic tools. Point coding assistants at [AGENTS.md](../AGENTS.md) for technical conventions.

When AI generated the bulk of a pull request, check the disclosure box in the pull request template.
