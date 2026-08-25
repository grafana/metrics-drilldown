import { splitAlwaysVisible } from './AttributeDistribution';
import { type AttributeConfig } from './attributeDistributionState';

function attr(attribute: string): AttributeConfig {
  return { attribute, attribute_name: attribute };
}

describe('splitAlwaysVisible', () => {
  it('keeps a priority field always visible when there is no pinning at all', () => {
    const attributes = [attr('a'), attr('b'), attr('c')];
    const { alwaysVisible, rest } = splitAlwaysVisible(attributes, new Set(['b']), [], 6);
    expect(alwaysVisible).toEqual([attr('b')]);
    expect(rest).toEqual([attr('a'), attr('c')]);
  });

  it('caps pinned fields at maxPriorityAndPinned, instead of always showing every pinned field', () => {
    // This is the exact bug: pinning was previously unbounded regardless of the cap, and every visible
    // field starts 3 concurrent range queries, defeating the entire purpose of the cap.
    const attributes = [attr('p1'), attr('p2'), attr('p3'), attr('p4')];
    const pinned = ['p1', 'p2', 'p3', 'p4'];
    const { alwaysVisible, rest } = splitAlwaysVisible(attributes, new Set(), pinned, 2);
    expect(alwaysVisible).toHaveLength(2);
    expect(rest).toHaveLength(2);
  });

  it('keeps the most recently pinned fields, not whatever position they happen to occupy in attributes', () => {
    // p1 was pinned first (oldest), p4 last (newest). Capping by array position (attributes' own
    // detection order) instead of pin recency could silently hide the field the user just pinned.
    const attributes = [attr('p4'), attr('p1'), attr('p2'), attr('p3')]; // detection order, not pin order
    const pinned = ['p1', 'p2', 'p3', 'p4']; // pin order: p4 is the most recent
    const { alwaysVisible } = splitAlwaysVisible(attributes, new Set(), pinned, 2);
    expect(alwaysVisible.map((a) => a.attribute).sort((a, b) => a.localeCompare(b))).toEqual(['p3', 'p4']);
  });

  it('shows zero pinned fields when maxPriorityAndPinned is 0, not every pinned field', () => {
    // Regression check for a slice(-0) pitfall: -0 as a slice argument behaves like 0 in JS, which
    // would return the whole array instead of none of it if the cap were implemented naively.
    const attributes = [attr('p1'), attr('p2')];
    const { alwaysVisible, rest } = splitAlwaysVisible(attributes, new Set(), ['p1', 'p2'], 0);
    expect(alwaysVisible).toEqual([]);
    expect(rest.map((a) => a.attribute).sort((a, b) => a.localeCompare(b))).toEqual(['p1', 'p2']);
  });

  it('pushes priority-detected fields out entirely once pinning alone fills the cap', () => {
    const attributes = [attr('priority-a'), attr('pinned-a'), attr('pinned-b')];
    const { alwaysVisible, rest } = splitAlwaysVisible(attributes, new Set(['priority-a']), ['pinned-a', 'pinned-b'], 2);
    expect(alwaysVisible.map((a) => a.attribute)).toEqual(['pinned-a', 'pinned-b']);
    expect(rest).toEqual([attr('priority-a')]);
  });

  it('treats an unbounded cap (Infinity) as no cap at all, keeping every pinned field visible', () => {
    const attributes = Array.from({ length: 20 }, (_, i) => attr(`p${i}`));
    const pinned = attributes.map((a) => a.attribute);
    const { alwaysVisible, rest } = splitAlwaysVisible(attributes, new Set(), pinned, Number.POSITIVE_INFINITY);
    expect(alwaysVisible).toHaveLength(20);
    expect(rest).toHaveLength(0);
  });
});
