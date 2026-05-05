# Bet: Replace fragile global error capture with a scoped React Error Boundary

> **Related issue:** [#1224](https://github.com/grafana/metrics-drilldown/issues/1224)
> **Appetite:** ~1 small cycle (≈3 days, single engineer)
> **Status:** Proposed
> **Author:** TBD

## Problem

Metrics Drilldown's "Fatal error!" screen is triggered by two coupled mechanisms that have proven painful:

- A hand‑maintained allowlist of *exact* English error message strings in `src/shared/logger/faro/faro.ts` (`errorsToIgnore`) plus a separate `SAFARI_EXTENSION_ERROR_PREFIX` constant in `src/App/useCatchExceptions.ts`. Every browser or Grafana minor version that rephrases an error forces a follow‑up PR (#538, #849, #1219, #1223). We've already paid this tax 4+ times.
- A global `window.error` listener in `useCatchExceptions` that fires for any script on the page — browser extensions, Grafana core, other plugins — and replaces the entire MD UI with `<ErrorView>` for the user.

The first attempt at using `<ErrorBoundary>` (PR #228 → reverted by #233) was rolled back because it caught lazy‑chunk load failures and dropped users into the fatal screen. Grafana core has since publicized the fix pattern (PRs grafana/grafana#19128, #20170, #55339), so the constraint that drove #233 is well understood and solvable.

## Success criteria

- A single, *typed‑pattern* source of truth for ignored errors (regex, not exact strings).
- Errors that originate **outside** the MD plugin never replace the MD UI.
- Errors that originate **inside** MD render trees still show the existing Fatal error UX *and* still reach Frontend O11y with the same `handheldBy` taxonomy.
- A failed `React.lazy` chunk download produces a "couldn't load this view, retry" soft state — not a fatal crash.
- No new entry has to be added to `errorsToIgnore` for the next browser rephrasing of `ResizeObserver loop completed`.

## Evidence

### Cross‑repo comparison (Drilldown family)

Metrics Drilldown is the **only** Drilldown app that still maintains an exact‑string ignore list + global `window.error` listener. Every sister app has already converged on a simpler model.

| Repo | Faro setup | App‑level boundary | Per‑feature boundary | `errorsToIgnore` allowlist | `window.error` listener |
|---|---|---|---|---|---|
| **metrics-drilldown** (this app) | Isolated Faro (`isolate: true`) | ❌ removed in PR #233 | ❌ | ✅ fragile, 5 strings | ✅ overzealous |
| **profiles-drilldown** | Isolated Faro (`isolate: true`) | ✅ `<ErrorBoundary>` + `<ErrorPage>` (PR #264) | — | ❌ | ❌ |
| **logs-drilldown** | `@grafana/runtime` `logError` (global Faro) | ❌ | ✅ `<ErrorBoundaryAlert>` per config page (PR #1735) | ❌ | ❌ |
| **traces-drilldown** | none in `src/` tree | ❌ | ❌ | ❌ | ❌ |
| **sql-drilldown** | none | ❌ | ✅ `<ErrorBoundaryAlert>` per panel in `RowsScene.tsx` | ❌ | ❌ |

Key takeaways:

- **profiles-drilldown is the closest mirror of MD's setup** (same `isolate: true` Faro, same `handheldBy: 'React error boundary'` taxonomy, same `<InlineBanner>`/`displayError` shape, same author of the original architecture). Their `App.tsx` keeps the canonical `ErrorBoundary onError={setError}` + `<ErrorPage>` pattern that MD removed in #233. They live without an `errorsToIgnore` list and without a global `window.error` listener — MD can do the same.
- **logs-drilldown PR #1735** (`feat(default columns): Wrap default columns in error boundary`, merged Feb 2026) demonstrates the same family is now actively *adding* boundary scoping where it was missing — the direction of travel across all drilldowns is toward more (not fewer) boundaries.
- **logs-drilldown issue #1713** (open: "ChunkLoadError: investigate if the error can be catched (e.g. ErrorBoundary) and better communicated") is the *exact same* UX gap our Step 4 closes. Our work is also a partial answer to a sister team's open question; conversely, their issue gives us a public reference point for designing the recovery UX.
- **profiles-drilldown PR #312** (`fix(Header): Prevent crash if useChromeHeaderHeight is not available (for Grafana < v11.3)`) shows the failure mode an app‑level boundary catches gracefully — the boundary turned a hard crash into a recoverable one while the targeted fix shipped. MD has the same risk surface (any `@grafana/runtime` API that may not exist on older Grafana versions). The boundary is the safety net for that whole class of regressions, not just the listed string errors.
- **profiles-drilldown PR #302** (`test(EndToEnd): Add expectation to prevent waiting when a fatal error…`) shows the same drilldown family hardening their CI against the fatal screen wasting Playwright time — worth replicating in MD's e2e once the new boundary is in place.
- **sql-drilldown** uses `<ErrorBoundaryAlert>` directly around a single dangerous scene (`RowsScene.tsx`) — a proof point that the per‑scene scoping mode works for an isolated rendering risk, even without app‑level coverage. This is the model for any future MD per‑panel boundaries (out‑of‑scope for this bet, but a sane next step).

Net: every sister app has already moved away from the pattern MD is stuck on. The bet is bringing MD in line with **profiles-drilldown's proven shape**, plus the chunk‑load handling that MD specifically needs because of its lazy routes.

### Current behavior

- `src/App/App.tsx:14-32` — `initFaro()` is called at module load; `useCatchExceptions()` is called from the root `App`; if `error` is set, the entire app is replaced by `<ErrorView>`. There is **no React error boundary** wrapping `<AppRoutes>` today, despite the comment in `useCatchExceptions.ts:91` claiming otherwise.
- `src/App/useCatchExceptions.ts` — Adds two `window` listeners (`error`, `unhandledrejection`). `shouldTreatAsApplicationError()` filters via `shouldIgnoreError(message)`, an inline `SAFARI_EXTENSION_ERROR_PREFIX.startsWith` check, and an `extension:` URL protocol check on `errorEvent.filename`. Ignored events still get Faro‑logged via `logger.error` with metadata (`errorType`, `extensionName`, `filename`, …).
- `src/shared/logger/faro/faro.ts:15-26` — The `errorsToIgnore` array (5 exact strings) is exported and reused both by the hook and by `initializeFaro({ ignoreErrors })`.
- `src/shared/logger/logger.ts:80-88` — `logger.error` calls `getFaro()?.api.pushError(error, { context })` against MD's **isolated** Faro instance.
- `src/App/InlineBanner.tsx:30-41` — Calls `logger.error` with `errorContext.bannerTitle` and a `handheldBy` tag carried through from callers.
- `src/App/ErrorView.tsx:41` — Currently sets `errorContext: { handheldBy: 'React error boundary' }` even though the trigger is actually the window listeners. So FE O11y queries already use this taxonomy and we should be careful not to break it.
- `src/MetricsReducer/helpers/displayStatus.ts:7` — Other call sites use `handheldBy: 'displayError'`, confirming `handheldBy` is the column FE O11y dashboards likely group by.
- **Lazy chunks are real**: `src/App/Routes.tsx:8` (`Trail`), `src/module.tsx:16-54`, and `src/exposedComponents/*/Lazy*.tsx` all use `React.lazy(() => import(...))`. A failed chunk download is a normal failure mode, not a bug.

### History

- **PR #228** (`feat: Add error boundary + logger`, 2025‑Mar) — introduced `<ErrorBoundary>` from `@grafana/ui`.
- **PR #233** (`fix(App): Remove the ErrorBoundary component`, 2025‑Mar) — removed the boundary because async chunk‑loading errors were being caught and crashing the app into the fatal screen. The fix was attributed as a "shot in the dark."
- **PRs #538, #849, #1219, #1223** — each added a new entry to `errorsToIgnore` or a new special‑case branch (Safari extension prefix). This is the fragility tax.
- **profiles-drilldown PR #264** (`refactor(*): Improve error tracking`, 2024‑Nov, by `@grafakus`) — the original blueprint MD's tracking layer was forked from. Profiles kept the `<ErrorBoundary>` around the app; MD lost it in #233 and never got it back. This bet restores parity.

### Cross‑repo links

- profiles-drilldown App.tsx (current): https://github.com/grafana/profiles-drilldown/blob/main/src/app/App.tsx
- profiles-drilldown ErrorPage.tsx (current): https://github.com/grafana/profiles-drilldown/blob/main/src/app/ui/ErrorPage.tsx
- profiles-drilldown PR #264 (`Improve error tracking`): https://github.com/grafana/profiles-drilldown/pull/264
- profiles-drilldown PR #312 (`Prevent crash if useChromeHeaderHeight is not available`): https://github.com/grafana/profiles-drilldown/pull/312
- profiles-drilldown PR #302 (`E2E expectation to prevent waiting on fatal error`): https://github.com/grafana/profiles-drilldown/pull/302
- logs-drilldown PR #1735 (`Wrap default columns in error boundary`): https://github.com/grafana/logs-drilldown/pull/1735
- logs-drilldown issue #1713 (`ChunkLoadError + ErrorBoundary`): https://github.com/grafana/logs-drilldown/issues/1713
- sql-drilldown `RowsScene.tsx` (per‑panel `<ErrorBoundaryAlert>`): https://github.com/grafana/sql-drilldown/blob/main/src/pages/Home/scenes/RowsScene.tsx

### Library APIs

- `@grafana/ui` `ErrorBoundary` supports `errorLogger`, `onError`, `onRecover`, `dependencies` (recovery via prop change), and `boundaryName`. The default `errorLogger` calls `faroWebSdk.faro?.api?.pushError(...)`, which targets the **global** Faro, not our isolated one — this is exactly the "we lose Frontend O11y" risk in option 1 of the issue. Passing our own `errorLogger` solves it cleanly.
- `@grafana/faro-core` `Config.ignoreErrors?: Patterns` where `Patterns = Array<string | RegExp>`. Faro v1.13+/v2.x matches against message **and** stack trace (Faro PR #1000), so a single regex like `/chrome-extension:\/\//` filters extension errors regardless of how the browser phrases them.
- `package.json` declares `@grafana/faro-web-sdk ^2.2.1`; pnpm lock resolves `2.2.4` and `@grafana/faro-core 2.2.4`. Stack‑trace‑aware `ignoreErrors` shipped well before this. ✅

### React error boundary semantics

Boundaries catch errors in render, lifecycle, and constructors of children. They do **not** catch errors thrown from event handlers, `setTimeout`, native promises, or SSR. So a boundary alone cannot fully replace the `unhandledrejection` listener for telemetry — but Faro's built‑in instrumentation already covers those, so MD doesn't need its own listener for that purpose.

## Uncertainties

1. **Frontend O11y dashboards key off `handheldBy` and the existing app‑name (`grafana-metricsdrilldown-app-*`)**. We will preserve both. If dashboards also rely on `event.context.type === 'boundary'` (the default key set by `@grafana/ui`'s built‑in errorLogger), we should check before launch — easy via Faro Explore.
2. **Chunk‑load failures still happen post‑#233.** The plugin uses `React.lazy` widely; the symptom that drove #233 is latent, not gone. Any plan that re‑introduces a render boundary must include explicit `ChunkLoadError` recovery. (This is the highest‑risk rabbit hole.)
3. **We can drop the `window.error` listener entirely.** Faro's built‑in `errors` instrumentation already subscribes to `window.onerror` / `onunhandledrejection` and reports through our isolated instance, so we will not lose telemetry — only the "replace the whole UI with Fatal error" behavior, which is the desired outcome.
4. **The current `unhandledrejection → cancelled` shortcut is still needed** (`useCatchExceptions.ts:108-112`). It's a TODO pinned to `MetricSelectScene`. Whatever we keep needs to retain (or refactor) this special case.
5. **Open question for the issue author / @bohandley**: should we keep the "Fatal error" full‑page UX at all, or should we degrade to a per‑route boundary so a single broken scene doesn't take down navigation? Recommendation below adds at least a route‑level boundary and an app‑level boundary as a safety net, but explicit confirmation is wanted before locking that in.

## Alternatives considered

| # | Approach | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A** | **Status‑quo, only swap exact strings → regex in Faro `ignoreErrors`** | Minimal diff. Removes the *fragility* half. | Keeps the `window.error` listener and the overzealous fatal UI. Doesn't address the original complaint. | ❌ Half a fix |
| **B** | **`@grafana/ui` `<ErrorBoundary>` only** (issue option 1, full swap) | Tightest scoping. Built‑in semantics. Less code. | Default `errorLogger` writes to the **global** Faro (we'd lose `grafana-metricsdrilldown-app-*` events). Async/event‑handler errors go uncaught for our UI. Re‑introduces the chunk‑load crash from PR #233 if not handled. | ❌ as‑is, ✅ if customized — see C |
| **C** | **Hybrid: `<AppErrorBoundary>` (custom `errorLogger`) + drop `window.error` listener + Faro `ignoreErrors` as regex + ChunkLoadError recovery** (issue option 2, evolved) | Tight scoping. Preserves isolated Faro / `handheldBy` / FE O11y dashboards. Eliminates fragile string list. Explicitly handles the failure mode that caused PR #233. Async errors still get Faro‑reported via Faro's built‑in instrumentation, just don't take down the UI. | More moving parts than B. Need to handle ChunkLoadError. | ✅ **Recommended** |
| **D** | **Custom error boundary class** (issue option 3) | Total control. | Reimplements what `@grafana/ui` already provides. The only reason to do this — replacing the default Faro logger — is already a one‑line `errorLogger` prop on the existing component. | ❌ Not justified |

## Chosen bet — Option C (hybrid)

The change has four small surfaces. (No code in this doc — just intent and target files.)

### Step 1 — Move ignored errors to Faro `ignoreErrors` regex (single source of truth)

**Target:** `src/shared/logger/faro/faro.ts`
**Intent:** Replace the `errorsToIgnore: string[]` exact list with an `ignoreErrorsPatterns: Array<string | RegExp>` regex list, e.g.:

- `/^ResizeObserver loop/i`
- `/^Non-Error exception captured with keys/`
- `/^Failed sending payload to the receiver/`
- `/chrome-extension:\/\//`
- `/moz-extension:\/\//`
- `/^Looks like there is an error in the background page/`

Pass this list as Faro's `ignoreErrors`. Drop the per‑string exported helper `shouldIgnoreError`.

**Validation:** `src/shared/logger/faro/__tests__/faro.test.ts` is updated; we add a regression test that asserts each historical error string still matches at least one pattern (anchored to PRs #538, #849, #1219, #1223).

### Step 2 — Add an MD‑scoped `<AppErrorBoundary>` and remove the global listeners

**Targets:**

- New `src/App/AppErrorBoundary.tsx` (thin wrapper over `@grafana/ui`'s `ErrorBoundary`, **not** a custom class).
- `src/App/App.tsx` — wrap `<AppRoutes>` and the embedded providers.
- Delete `src/App/useCatchExceptions.ts` (or shrink it to nothing — see Step 3).

**Intent of the wrapper:**

- `boundaryName="metrics-drilldown-app"`.
- `errorLogger={(error) => logger.error(error, { handheldBy: 'React error boundary' })}` — preserves isolated Faro routing AND the existing `handheldBy` taxonomy. (This is the surgical answer to issue research question 2.)
- Renders the existing `<ErrorView>` on error so the Fatal UI stays pixel‑identical for genuine MD render errors.
- Accepts `dependencies={[location.pathname]}` (or similar) so navigation away from the broken route auto‑recovers — addresses today's "the only escape is hard‑reload" UX.
- Special case for chunk‑load failures (Step 4).

**Validation:** New unit test that throws inside a child component and asserts (a) `<ErrorView>` is rendered, (b) `logger.error` was called once with `handheldBy: 'React error boundary'`, (c) navigation resets the boundary. Existing `useCatchExceptions.test.ts` is removed.

### Step 3 — Decide on async/event‑handler coverage

**Target:** `src/App/useCatchExceptions.ts` (deletion or skinny rewrite).
**Intent:** Faro's default error instrumentation already subscribes to `window.onerror` and `onunhandledrejection`, so all uncaught errors continue to reach FE O11y without our hook. The only thing the hook adds today is *UI replacement* — which is precisely what we don't want for non‑MD events.

Two sub‑options:

- **3a (preferred):** Delete the hook. Async errors no longer flip the UI to fatal. The boundary covers render errors. We lose nothing in telemetry.
- **3b (fallback if FE O11y dashboards turn out to need our `errorType` / `extensionName` / `bannerTitle` enrichments):** Keep an `unhandledrejection`‑only listener that *only* logs (does **not** call `setError`). Then it's telemetry‑only and the "overzealous fatal crash" problem is solved.

The `cancelled`‑promise short‑circuit (TODO around `MetricSelectScene`) gets logged for follow‑up; it doesn't need to live in this hook.

**Validation:** Manual smoke — load a page with a problematic Safari extension installed and verify MD continues to render. Faro test environment shows the extension error logged but no UI flip.

### Step 4 — Chunk‑load recovery (the "don't repeat #233" gate)

**Target:** `src/App/AppErrorBoundary.tsx` and possibly per‑route boundaries inside `src/App/Routes.tsx`.
**Intent:** Detect `error.name === 'ChunkLoadError'` (or message `/Loading chunk \d+ failed|Failed to fetch dynamically imported module/`). Instead of `<ErrorView>`, render a soft banner: "A new version of Metrics Drilldown is available — reloading…" and call `window.location.reload()` after a short delay (or expose a "Reload" button). This is the same pattern Grafana core uses for its lazy routes (PR grafana/grafana#55339).

**Validation:**

- Manual: in dev, rename a built chunk to simulate a 404; verify reload banner instead of fatal screen.
- Automated: unit test that throws a synthetic `ChunkLoadError` inside the boundary and asserts the reload path, not the fatal path.
- **Exit criterion:** before merge, deploy to dev/ops and watch for `error.name === 'ChunkLoadError'` events for one full deploy cycle to confirm the recovery path fires correctly post‑deploy. This is the gate that PR #233 didn't have.

### Step 5 — Cleanup

- Drop the comment in `useCatchExceptions.ts:91` claiming there is an ErrorBoundary (resolved by reality).
- Update `docs/project-intent.md` (or add `docs/error-handling.md`) with one paragraph on the new contract: *"Errors thrown inside MD's React tree are caught by `<AppErrorBoundary>` and reach Faro via `logger.error` with `handheldBy: 'React error boundary'`. Errors outside MD do not affect the MD UI. Faro `ignoreErrors` regex is the single allowlist for known noisy errors."*

## Answers to the issue's research questions

1. **Will ErrorBoundary ever cause fatal crashes?** Only for the kind of error it's supposed to catch — render‑time errors in our own tree. The historical PR #233 regression was specifically chunk‑load errors; Step 4 explicitly handles them.
2. **Will we need to change the FE O11y dashboard?** No, as long as we pass a custom `errorLogger` that calls our `logger.error` with `handheldBy: 'React error boundary'`. The existing `app.name`, `app.environment`, and Faro `isolate: true` scoping all keep working. Worth a 5‑minute pre‑merge eyeball of the existing dashboard panels to confirm no panel filters on `event.context.type === 'boundary'` (the default `@grafana/ui` key, which we're intentionally overriding).
3. **Edge cases when switching to ErrorBoundary?** Three known ones, all addressed: (a) chunk loading → Step 4; (b) async/event‑handler errors don't bubble to boundaries → Step 3 explicitly covers; (c) errors in providers above the boundary → wrap broad enough to cover `PluginPropsContext` and `AppContext` but **outside** the providers needed by `<ErrorView>` itself (it uses `useNavigate` / `useLocation`, so the boundary must sit *inside* the router).

## Cross‑repo signals to act on

Beyond strengthening the case, the cross‑repo audit produced two concrete follow‑ups that fit naturally into this bet:

- **Coordinate with logs-drilldown on issue #1713.** Their open issue and our Step 4 are the same problem. Once Step 4 ships in MD, post the pattern (boundary + `ChunkLoadError` detection + soft reload) on #1713 so the wider Drilldown family can adopt it. This also creates external review pressure on our chunk‑load UX before merge.
- **Replicate profiles-drilldown PR #302's e2e guard.** Add an explicit Playwright expectation that the `<ErrorView>` banner is *not* visible after navigation, so a future regression can't quietly waste 15 minutes of CI time. This is small (one test addition) and lives alongside Step 2's tests.

## Risks & rollback

- **R1 — Repeating PR #233.** Mitigation: Step 4 is a hard gate; merge is blocked until ChunkLoadError recovery is observed in a real deploy. Rollback is a one‑line revert that re‑exposes the existing `<ErrorView>` path; no schema/storage migration to undo.
- **R2 — FE O11y dashboard drift.** If a panel relies on the default `event.context.type: 'boundary'` set by `@grafana/ui`'s default logger, our custom `errorLogger` will not emit that key. Mitigation: emit *both* the existing `handheldBy: 'React error boundary'` and an explicit `boundaryName` in the context. Verify dashboards in Faro Explore before merge.
- **R3 — Loss of contextual enrichments.** Today, Safari/extension errors get logged with `errorType`, `extensionName`, `lineno`, `colno`. After the change, Faro's built‑in instrumentation logs them but without those fields. Mitigation: if FE O11y reports show a regression in extension‑error attribution, re‑introduce a *telemetry‑only* `window.error` listener that logs but never calls `setError` (option 3b).
- **R4 — `cancelled` promise leakage.** The `event.reason.type === 'cancelled'` short‑circuit becomes orphaned. Mitigation: track as a follow‑up issue against `MetricSelectScene`; any leakage that reaches Faro is filtered via `ignoreErrors` regex `/^cancelled$/` or by `beforeSend` if needed.
- **R5 — Tests dependent on hook.** `useCatchExceptions.test.ts` is heavily exercised. Mitigation: replace it with a smaller `AppErrorBoundary.test.tsx` that asserts the same outcomes (regex‑ignored messages don't reach Faro, render errors do, `handheldBy` is correct).
- **Rollback plan:** Single‑PR change. If a regression surfaces in dev/ops, revert the PR; the previous `useCatchExceptions` + `errorsToIgnore` exact list returns. No data or config migrations are involved.

## Out of scope

- Replacing or refactoring the existing `<ErrorView>` UI itself. (We reuse it as the boundary's fallback.)
- Reworking the `MetricSelectScene` cancellation handling. Tracked as a follow‑up.
- Changing the global Faro initialization timing or the `beforeSend` URL filter. (Both are working.)
- Per‑panel boundaries inside `<Trail>`. The bet adds an app‑level boundary; finer‑grained scenes/breakdown boundaries (the model `sql-drilldown`'s `RowsScene.tsx` and `logs-drilldown` PR #1735 follow) are a sensible follow‑up if signal volume warrants.
- Cross‑drilldown harmonization of the logger/Faro layer. `logs-drilldown` and `traces-drilldown` use `@grafana/runtime`'s `logError` against the global Faro; MD and `profiles-drilldown` use isolated Faro instances. This split is a separate platform‑level conversation.
