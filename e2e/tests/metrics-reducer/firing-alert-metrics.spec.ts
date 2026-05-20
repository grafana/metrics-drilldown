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
    expect(group).toBeDefined();
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

  test('Ruler endpoint with state=firing filter returns empty groups when no alerts are firing', async ({ page }) => {
    const response = await page.request.get(
      `${GRAFANA_RULER_RULES_URL}?state=firing&limit_alerts=0`
    );

    expect(response.ok()).toBe(true);

    const body = await response.json();

    expect(body.status).toBe('success');
    expect(Array.isArray(body.data.groups)).toBe(true);

    // Older Grafana versions (≤12.0.x) return group shells with empty rules arrays
    // instead of omitting groups entirely, so assert no rules rather than no groups
    const totalRules = body.data.groups.reduce(
      (sum: number, g: { rules: unknown[] }) => sum + g.rules.length,
      0
    );
    expect(totalRules).toBe(0);
  });
});
