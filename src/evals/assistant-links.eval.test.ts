import { linkConfigs } from 'extensions/links';

import { linkCases, type LinkEvalCase } from './cases/assistant-links.cases';

const ASSISTANT_TARGET_V0 = 'grafana-metricsdrilldown-app/grafana-assistant-app/navigateToDrilldown/v0-alpha';

const v0Link = linkConfigs.find((c) => (c.targets as string[]).includes(ASSISTANT_TARGET_V0));

function resolveParams(input: LinkEvalCase['input']): Array<[string, string]> | null {
  const result = v0Link!.configure!(input as never) as { path: string } | undefined;
  if (!result) {
    return null;
  }
  const query = result.path.split('?')[1] ?? '';
  return Array.from(new URLSearchParams(query).entries());
}

describe('evals: Assistant -> Drilldown link (v0-alpha target)', () => {
  it('has a unique id and a failure mode on every case', () => {
    const ids = linkCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    linkCases.forEach((c) => expect(c.failureMode).toBeTruthy());
  });

  it('finds the v0 assistant link config', () => {
    expect(v0Link).toBeDefined();
  });

  it.each(linkCases.filter((c) => !c.knownIssue))('$failureMode: $id', (c) => {
    expect(resolveParams(c.input)).toEqual(c.expectedParams);
  });

  // `it.failing` passes while the defect exists and fails once it is fixed: remove `knownIssue` then.
  it.failing.each(linkCases.filter((c) => c.knownIssue))('known issue, $failureMode: $id ($knownIssue)', (c) => {
    expect(resolveParams(c.input)).toEqual(c.expectedParams);
  });
});
