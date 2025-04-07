# Contributing to Grafana Metrics Drilldown

Welcome! We're excited that you're interested in contributing. Below are some basic guidelines.

## Workflow

Grafana Metrics Drilldown follows a standard GitHub pull request workflow. If you're unfamiliar with this workflow, read the very helpful [Understanding the GitHub flow](https://guides.github.com/introduction/flow/) guide from GitHub.

You are welcome to create draft PRs at any stage of readiness - this
can be helpful to ask for assistance or to develop an idea.  
Before a piece of work is finished, it should:

- Be organised into one or more commits, each of which has a commit message that describes all changes made in that commit ('why' more than 'what' - we can read the diffs to see the code that changed).
- Each commit should build towards the whole - don't leave in back-tracks and mistakes that you later corrected.
- Have unit for new functionality or tests that would have caught the bug being fixed.

## Requirements

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en) v22
- [Docker](https://www.docker.com/get-started/) or [OrbStack](https://orbstack.dev/download) (lighter alternative)

## Get started

1. Clone the repository `git clone git@github.com:grafana/metrics-drilldown.git`
2. Install the dependencies: `npm install`
3. Build the plugin in dev mode: `npm run dev`
4. Start the Grafana server (with static data): `npm run server`

Then visit http://localhost:3001/a/grafana-metricsdrilldown-app/

## Contribution guidelines

For developing in this repo, requirements are generally managed by lint rules and pre-commit hooks. However, for other things, like code organization, please follow the pattern established by the rest of the repo.

### Lint and format your code

We use [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) to lint and format our code. These will be run in a pre-commit hook, but you can also setup your IDE to run them on save.

### Commit messages and PR titles

We use [conventional commits](https://www.conventionalcommits.org/) to format our commit messages. This allows us to automatically generate changelogs and version bumps.

When opening a Pull Request (PR), please make sure that the title is properly prefixed with one of the following type: `feat`, `fix`, `docs`, `test`, `ci`, `refactor`, `perf`, `chore` or `revert`.

### Test your code

We encourage you to write tests, whether they are unit tests or end-to-end tests. They will give us the confidence that the plugin behaves as intended and help us capture any regression early.

For end-to-end testing (E2E), please have a look at our [E2E testing documentation](./end-to-end-testing.md).

## Common problems & solutions

...
