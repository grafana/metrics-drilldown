import { availableIconsIndex } from '@grafana/data';

import { SideBar } from '../SideBar';

describe('SideBar sections', () => {
  const sections = new SideBar({}).state.sections;

  it('lists the category filter first', () => {
    expect(sections[0].state.key).toBe('filters-category');
  });

  it('uses the OpenTelemetry icon for the category filter, and the icon exists', () => {
    const icon = sections[0].state.icon;

    expect(icon).toBe('open-telemetry');
    expect(icon in availableIconsIndex).toBe(true);
  });

  it('keeps the other filters in their order after the category filter', () => {
    expect(sections.map((section) => section.state.key)).toEqual([
      'filters-category',
      'filters-rule',
      'filters-prefix',
      'filters-suffix',
      'filters-recent',
      'groupby-labels',
      'bookmarks',
    ]);
  });
});
