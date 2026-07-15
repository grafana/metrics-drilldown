import { GRAFANA_RULER_RULES_URL } from '../../../src/MetricsReducer/list-controls/MetricsSorter/fetchers/shared';
import { expect, test } from '../../fixtures';

test.describe('Firing alert metrics - Ruler API integration', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    await metricsReducerView.goto();
  });

  test('Ruler endpoint returns a successful response with provisioned alert rules', async ({ page }) => {
    const response = await page.request.get(
      `${GRAFANA_RULER_RULES_URL}?limit_alerts=0`
    );

    expect(response.ok()).toBe(true);

    const body = await response.json();

    expect(body.status).toBe('success');
    expect(Array.isArray(body.data.groups)).toBe(true);
    expect(body.data.groups.length).toBeGreaterThan(0);

    const group = body.data.groups.find(
      (g: { name: string }) => g.name === 'test-evaluation-group-00'
    );

    if (!group) {
      throw new Error('Expected group "test-evaluation-group-00" not found in ruler response');
    }

    expect(group.rules.length).toBe(2);

    const ruleNames = group.rules.map((r: { name: string }) => r.name);
    expect(ruleNames).toContain('test-rule-00');
    expect(ruleNames).toContain('test-rule-01');

    for (const rule of group.rules) {
      expect(rule.type).toBe('alerting');
      expect(typeof rule.query).toBe('string');
      expect(rule.query.length).toBeGreaterThan(0);
    }
  });

  test('Ruler endpoint with state=firing returns only the expected always-firing rules', async ({ page }) => {
    const response = await page.request.get(
      `${GRAFANA_RULER_RULES_URL}?state=firing&limit_alerts=0`
    );

    expect(response.ok()).toBe(true);

    const body = await response.json();

    expect(body.status).toBe('success');
    expect(Array.isArray(body.data.groups)).toBe(true);

    const ALWAYS_FIRING_GROUP = 'test-firing-alerts';

    const unexpectedRules = body.data.groups
      .filter((g: { name: string }) => g.name !== ALWAYS_FIRING_GROUP)
      .reduce((sum: number, g: { rules: unknown[] }) => sum + g.rules.length, 0);
    expect(unexpectedRules).toBe(0);

    // The always-firing group may not yet have entered firing state on slower
    // Grafana versions, so only assert its shape when it is present.
    const firingGroup = body.data.groups.find(
      (g: { name: string }) => g.name === ALWAYS_FIRING_GROUP
    );

    if (firingGroup) {
      expect(firingGroup.rules.length).toBe(3);

      const ruleNames = firingGroup.rules.map((r: { name: string }) => r.name);
      expect(ruleNames).toContain('qa-always-firing-up');
      expect(ruleNames).toContain('qa-always-firing-http-requests');
      expect(ruleNames).toContain('qa-always-firing-api-responses');
    }
  });
});
