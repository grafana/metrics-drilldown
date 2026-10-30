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

async function submit(session: ReturnType<typeof createProfileAssistantSession>, value: Record<string, unknown>) {
  return JSON.parse(String(await session.tools.at(-1)!.invoke(value, options)));
}

it('offers bounded metadata tools and draft submission, snapshots data, and redacts URLs', async () => {
  const metadata = { type: 'counter', help: 'Original HELP. https://example.invalid/private', unit: 'seconds' };
  const session = createProfileAssistantSession(names, () => metadata, 'explore');
  metadata.help = 'Changed after datasource switch';
  expect(session.tools.map((tool) => tool.name)).toEqual([
    'jev_search_metric_metadata',
    'jev_get_metric_metadata',
    'jev_submit_ranking_profile',
  ]);
  const result = String(await session.tools[1].invoke({ names: ['metric_099'] }, options));
  expect(result).toContain('Original HELP. [link omitted]');
  expect(result).not.toContain('Changed after datasource');
  expect(result).not.toContain('https://');
  const prompt = JSON.parse(session.prompt('Synthetic explanation.'));
  expect(prompt.catalog.sample).toHaveLength(12);
  expect(prompt.catalog.totalMatchingMetrics).toBe(100);
  expect(prompt.submissionLimits.maxAttempts).toBe(2);
  expect(prompt.submissionTool).toBe('jev_submit_ranking_profile');
  expect(prompt).not.toHaveProperty('datasourceUid');
  expect(prompt).not.toHaveProperty('history');
});

it('provides only submission when drafting from an explanation and permits known user-supplied evidence', async () => {
  const session = createProfileAssistantSession(names, peek, 'describe');
  expect(session.tools.map((tool) => tool.name)).toEqual(['jev_submit_ranking_profile']);
  const raw = proposal('metric_099');
  raw.evidence[0].basis = 'user';
  expect(() => session.getProposal()).toThrow('did not submit');
  expect(await submit(session, raw)).toMatchObject({ status: 'accepted' });
  expect(session.getProposal()).toEqual(raw);
});

it.each(['unknown', 'uninspected', 'mismatched'])('repairs %s evidence within a session', async (failure) => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  const raw = proposal(failure === 'unknown' ? 'invented_metric' : 'metric_099');
  if (failure === 'mismatched') {
    raw.profile.rules[0].match.exact = 'metric_000';
    raw.evidence[0].metricNames = ['metric_008']; // Inspected in the initial sample, but not an exact match.
  }
  const result = await submit(session, raw);
  expect(result).toMatchObject({ status: 'rejected', remainingAttempts: 1 });
  expect(result.message).toContain('Rule 1');
  expect(result.message).toContain(
    { unknown: 'outside the current catalog', uninspected: 'uninspected metadata', mismatched: 'does not match' }[
      failure
    ]
  );
  expect(JSON.stringify(result)).not.toMatch(/metric_\d|invented_metric|Synthetic meaning/);
  expect(() => session.getProposal()).toThrow(result.message);
  // Reading the missing metadata and then fixing the citation does not start another generation.
  await session.tools[1].invoke({ names: ['metric_099'] }, options);
  expect(await submit(session, proposal())).toMatchObject({ status: 'accepted' });
  expect(session.getProposal()).toEqual(proposal());
});

it.each([
  ['model consent', { ...proposal('metric_000'), shareWithJev: true }],
  ['missing evidence', { ...proposal('metric_000'), evidence: [] }],
  [
    'user evidence during exploration',
    { ...proposal('metric_000'), evidence: [{ ...proposal('metric_000').evidence[0], basis: 'user' }] },
  ],
  ['oversized input', { ...proposal('metric_000'), padding: 'x'.repeat(16_384) }],
])('rejects %s through structured submission without retaining a draft', async (_label, raw) => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  expect(await submit(session, raw)).toMatchObject({ status: 'rejected', remainingAttempts: 1 });
  expect(() => session.getProposal()).toThrow();
});

it('keeps submission attempts separate from metadata calls and fails closed after exhaustion', async () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  for (let i = 0; i < 6; i++) {
    await session.tools[0].invoke({ query: 'metric_000' }, options);
  }
  const raw = proposal('metric_000');
  expect(await submit(session, { ...raw, shareWithJev: true })).toMatchObject({
    status: 'rejected',
    remainingAttempts: 1,
  });
  expect(await submit(session, raw)).toMatchObject({ status: 'accepted' });
  expect(session.getProposal()).toEqual(raw);
  expect(await submit(session, raw)).toMatchObject({ status: 'rejected', remainingAttempts: 0 });
  expect(() => session.getProposal()).toThrow('submission limit');
});

it('does not reuse an accepted proposal after a later invalid submission', async () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  expect(await submit(session, proposal('metric_000'))).toMatchObject({ status: 'accepted' });
  expect(await submit(session, proposal('invented_metric'))).toMatchObject({
    status: 'rejected',
    remainingAttempts: 0,
  });
  expect(() => session.getProposal()).toThrow('outside the current catalog');
});

it('requires a successful submission even if valid JSON was parsed and accepts an explicitly submitted empty draft', async () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  session.parse(JSON.stringify(proposal('metric_000')));
  expect(() => session.getProposal()).toThrow('did not submit');
  const empty = { ...proposal('metric_000'), profile: { ...proposal().profile, rules: [] }, evidence: [] };
  expect(await submit(session, empty)).toMatchObject({ status: 'accepted' });
  expect(session.getProposal()).toEqual(empty);
});

it('rejects cancelled or stale submissions and retrieval without changing the proposal', async () => {
  let current = true;
  const session = createProfileAssistantSession(names, peek, 'explore', () => current);
  const tool = session.tools.at(-1)!;
  const controller = new AbortController();
  controller.abort();
  await expect(tool.invoke(proposal('metric_000'), { signal: controller.signal } as never)).rejects.toThrow();
  expect(await submit(session, proposal('metric_000'))).toMatchObject({ status: 'accepted' });
  current = false;
  await expect(submit(session, proposal('metric_000'))).rejects.toThrow();
  expect(() => session.getProposal()).toThrow();
});

it.each([
  ['plain JSON', (json: string) => json],
  ['JSON code fence', (json: string) => `\`\`\`json\n${json}\n\`\`\``],
  ['unlabelled code fence', (json: string) => `\`\`\`\n${json}\n\`\`\``],
  ['CRLF and surrounding whitespace', (json: string) => ` \n\`\`\`JSON \r\n${json}\r\n\`\`\`\n `],
])('accepts a complete proposal as %s', (_label, wrap) => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  const raw = proposal('metric_000');
  expect(session.parse(wrap(JSON.stringify(raw)))).toEqual(raw);
});

it.each([
  'Here is your profile:\n```json\n{}\n```',
  '```json\n{}\n```\nReview this profile.',
  '```json\n{}',
  '```json\n{}\n```\n```json\n{}\n```',
  '```javascript\n{}\n```',
  '```json\n{invalid}\n```',
])('rejects prose, incomplete blocks and invalid JSON: %s', (text) => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  expect(() => session.parse(text)).toThrow('valid JSON');
});

it('checks response size before unwrapping a code fence', () => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  const json = JSON.stringify(proposal('metric_000'));
  expect(() => session.parse(`\`\`\`json\n${json.padEnd(16_384)}\n\`\`\``)).toThrow('valid JSON');
});

it.each([false, true])('requires inspected evidence and rejects model consent (fenced: %s)', async (fenced) => {
  const session = createProfileAssistantSession(names, peek, 'explore');
  const parse = (value: unknown) => {
    const json = JSON.stringify(value);
    return session.parse(fenced ? `\`\`\`json\n${json}\n\`\`\`` : json);
  };
  expect(() => parse(proposal())).toThrow('uninspected');
  await session.tools[1].invoke({ names: ['metric_099'] }, options);
  expect(parse(proposal()).evidence[0].basis).toBe('metadata');
  expect(() => parse({ ...proposal(), shareWithJev: true })).toThrow();
  expect(() => parse({ ...proposal(), profile: { ...proposal().profile, shareWithJev: true } })).toThrow();
  expect(() => parse({ ...proposal(), evidence: [] })).toThrow();
  const unknown = proposal();
  unknown.evidence[0].metricNames = ['invented_metric'];
  expect(() => parse(unknown)).toThrow();
  const mismatch = proposal();
  mismatch.evidence[0].metricNames = ['metric_000'];
  expect(() => parse(mismatch)).toThrow();
  expect(() => session.parse('```json\n{}\n```')).toThrow('profile and evidence');
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
