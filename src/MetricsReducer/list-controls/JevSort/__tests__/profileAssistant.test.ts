import { createProfileAssistantSession } from '../profileAssistant';

const names = Array.from({ length: 100 }, (_, i) => `metric_${String(i).padStart(3, '0')}`);
const peek = (name: string) => ({
  type: 'counter',
  help: `Synthetic meaning for ${name}. See https://example.invalid/private`,
  unit: 'requests',
});
const options = { manager: {} } as never;
function proposal(name = 'metric_099') {
  return {
    profile: {
      schemaVersion: 1,
      name: 'Synthetic',
      intent: 'Synthetic business objective.',
      rules: [{ match: { exact: name }, purpose: 'Synthetic meaning.', priority: 'high' }],
    },
    evidence: [
      {
        ruleIndex: 0,
        basis: 'metadata',
        metricNames: [name],
        explanation: 'Based on supplied HELP, not live behavior.',
      },
    ],
  };
}

it('offers only bounded cached-metadata tools, snapshots data, and redacts documentation URLs', async () => {
  const metadata = { type: 'counter', help: 'Original HELP. https://example.invalid/private', unit: 'seconds' };
  const session = createProfileAssistantSession(names, () => metadata, 'explore');
  metadata.help = 'Changed after datasource switch';
  expect(session.tools.map((tool) => tool.name)).toEqual(['jev_search_metric_metadata', 'jev_get_metric_metadata']);
  const result = String(await session.tools[1].invoke({ names: ['metric_099'] }, options));
  expect(result).toContain('Original HELP. [link omitted]');
  expect(result).not.toContain('Changed after datasource');
  expect(result).not.toContain('https://');
  const prompt = JSON.parse(session.prompt('Synthetic explanation.'));
  expect(prompt.catalog.sample).toHaveLength(12);
  expect(prompt.catalog.totalMatchingMetrics).toBe(100);
  expect(prompt).not.toHaveProperty('datasourceUid');
  expect(prompt).not.toHaveProperty('history');
});

it('does not provide exploration tools when drafting from an explanation', () => {
  const session = createProfileAssistantSession(names, peek, 'describe');
  expect(session.tools).toEqual([]);
  const raw = proposal('metric_099');
  raw.evidence[0].basis = 'user';
  expect(session.parse(JSON.stringify(raw)).profile.name).toBe('Synthetic');
});

it('requires matching inspected evidence and never accepts consent from the model', async () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  expect(() => session.parse(JSON.stringify(proposal()))).toThrow('uninspected');
  await session.tools[1].invoke({ names: ['metric_099'] }, options);
  expect(session.parse(JSON.stringify(proposal())).evidence[0].basis).toBe('metadata');
  expect(() => session.parse(JSON.stringify({ ...proposal(), shareWithJev: true }))).toThrow();
  expect(() =>
    session.parse(JSON.stringify({ ...proposal(), profile: { ...proposal().profile, shareWithJev: true } }))
  ).toThrow();
  expect(() => session.parse(JSON.stringify({ ...proposal(), evidence: [] }))).toThrow();
  const unknown = proposal();
  unknown.evidence[0].metricNames = ['invented_metric'];
  expect(() => session.parse(JSON.stringify(unknown))).toThrow();
  const mismatch = proposal();
  mismatch.evidence[0].metricNames = ['metric_000'];
  expect(() => session.parse(JSON.stringify(mismatch))).toThrow();
  expect(() => session.parse('```json\n{}\n```')).toThrow('valid JSON');
  expect(() => session.parse('x'.repeat(16385))).toThrow('valid JSON');
});

it('rejects invalid tool inputs, unknown names and over-budget/cancelled work', async () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  await expect(session.tools[0].invoke({ query: '', unexpected: true }, options)).rejects.toThrow();
  await expect(session.tools[1].invoke({ names: ['invented_metric'] }, options)).rejects.toThrow();
  for (let i = 0; i < 6; i++) {
    const result = JSON.parse(String(await session.tools[0].invoke({ query: 'metric_000' }, options)));
    expect(result.metrics).toHaveLength(1);
  }
  await expect(session.tools[0].invoke({ query: 'metric_000' }, options)).rejects.toThrow('budget');
  const controller = new AbortController();
  controller.abort();
  const next = createProfileAssistantSession(names, peek, 'explore');
  await expect(
    next.tools[1].invoke({ names: ['metric_000'] }, { signal: controller.signal } as never)
  ).rejects.toThrow();
  const moved = createProfileAssistantSession(names, peek, 'explore', () => false);
  await expect(moved.tools[1].invoke({ names: ['metric_000'] }, options)).rejects.toThrow();
});

it('caps unique inspected metrics across all tool calls, including the initial sample', async () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  const sample: Array<{ name: string }> = JSON.parse(session.prompt('')).catalog.sample;
  const unseen = names.filter((name) => !sample.some((metric) => metric.name === name));
  for (const selected of [unseen.slice(0, 10), unseen.slice(10, 20), unseen.slice(20, 28)]) {
    await session.tools[1].invoke({ names: selected }, options);
  }
  await expect(session.tools[1].invoke({ names: [unseen[28]] }, options)).rejects.toThrow('budget');
});

it('reports search truncation without returning an unbounded catalog', async () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  const result = JSON.parse(String(await session.tools[0].invoke({ query: 'metric_' }, options)));
  expect(result.metrics).toHaveLength(10);
  expect(result.totalMatches).toBe(100);
  expect(result.truncated).toBe(true);
});
