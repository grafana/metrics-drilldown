import { renderHook } from '@testing-library/react';

import { useLabelFiltering } from './useLabelFiltering';

import type { AdHocVariableFilter } from '@grafana/data';

describe('useLabelFiltering', () => {
  const allLabels = ['instance', 'job', 'service', 'environment', 'region', 'custom_label'];

  it('should return all labels when no filters and no selection', () => {
    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, [], null)
    );

    expect(result.current).toEqual(allLabels);
  });

  it('should filter out labels with equality filters', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=', value: 'localhost' },
      { key: 'environment', operator: '=', value: 'prod' },
    ];

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, null)
    );

    const expected = ['job', 'service', 'region', 'custom_label'];
    expect(result.current).toEqual(expected);
  });

  it('should filter out labels with inequality filters', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'job', operator: '!=', value: 'prometheus' },
      { key: 'region', operator: '!=', value: 'us-east-1' },
    ];

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, null)
    );

    const expected = ['instance', 'service', 'environment', 'custom_label'];
    expect(result.current).toEqual(expected);
  });

  it('should not filter out labels with regex filters', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=~', value: '.*local.*' },
      { key: 'environment', operator: '!~', value: '.*test.*' },
    ];

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, null)
    );

    // Regex filters should not cause labels to be filtered out
    expect(result.current).toEqual(allLabels);
  });

  it('should keep selected label visible even if it has equality filter', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=', value: 'localhost' },
      { key: 'environment', operator: '=', value: 'prod' },
    ];

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, 'instance')
    );

    // 'instance' should be included even though it's filtered
    const expected = ['instance', 'job', 'service', 'region', 'custom_label'];
    expect(result.current).toEqual(expected);
  });

  it('should keep selected label visible even if it has inequality filter', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'job', operator: '!=', value: 'prometheus' },
    ];

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, 'job')
    );

    // 'job' should be included even though it's filtered
    expect(result.current).toEqual(allLabels);
  });

  it('should handle mixed filter types correctly', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=', value: 'localhost' },
      { key: 'job', operator: '!=', value: 'prometheus' },
      { key: 'service', operator: '=~', value: '.*api.*' },
      { key: 'environment', operator: '!~', value: '.*test.*' },
    ];

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, null)
    );

    // Only equality and inequality filters should cause removal
    const expected = ['service', 'environment', 'region', 'custom_label'];
    expect(result.current).toEqual(expected);
  });

  it('should update when filters change', () => {
    const initialFilters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=', value: 'localhost' },
    ];

    const { result, rerender } = renderHook(
      ({ filters }) => useLabelFiltering(allLabels, filters, null),
      { initialProps: { filters: initialFilters } }
    );

    // Initially 'instance' should be filtered out
    expect(result.current).not.toContain('instance');

    // Update filters
    const newFilters: AdHocVariableFilter[] = [
      { key: 'job', operator: '=', value: 'prometheus' },
    ];

    rerender({ filters: newFilters });

    // Now 'instance' should be back, 'job' should be filtered out
    expect(result.current).toContain('instance');
    expect(result.current).not.toContain('job');
  });

  it('should update when selected label changes', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=', value: 'localhost' },
    ];

    const { result, rerender } = renderHook(
      ({ selectedLabel }) => useLabelFiltering(allLabels, filters, selectedLabel),
      { initialProps: { selectedLabel: null as string | null } }
    );

    // Initially 'instance' should be filtered out
    expect(result.current).not.toContain('instance');

    // Select 'instance'
    rerender({ selectedLabel: 'instance' });

    // Now 'instance' should be visible
    expect(result.current).toContain('instance');
  });

  it('should update when allLabels change', () => {
    const initialLabels = ['instance', 'job'];
    const filters: AdHocVariableFilter[] = [];

    const { result, rerender } = renderHook(
      ({ labels }) => useLabelFiltering(labels, filters, null),
      { initialProps: { labels: initialLabels } }
    );

    expect(result.current).toEqual(['instance', 'job']);

    // Update labels
    const newLabels = ['instance', 'job', 'service', 'environment'];
    rerender({ labels: newLabels });

    expect(result.current).toEqual(newLabels);
  });

  it('should handle empty allLabels array', () => {
    const { result } = renderHook(() =>
      useLabelFiltering([], [], null)
    );

    expect(result.current).toEqual([]);
  });

  it('should handle empty filters array', () => {
    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, [], null)
    );

    expect(result.current).toEqual(allLabels);
  });

  it('should be memoized and not recreate array unnecessarily', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=', value: 'localhost' },
    ];

    const { result, rerender } = renderHook(() =>
      useLabelFiltering(allLabels, filters, null)
    );

    const firstResult = result.current;

    // Re-render with same props
    rerender();

    const secondResult = result.current;

    // Should be the same array reference (memoized)
    expect(firstResult).toBe(secondResult);
  });

  it('should handle labels that match selected label name', () => {
    const filters: AdHocVariableFilter[] = [];
    const selectedLabel = 'instance';

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, selectedLabel)
    );

    // All labels should be present including the selected one
    expect(result.current).toEqual(allLabels);
  });

  it('should handle case where selected label is not in allLabels', () => {
    const filters: AdHocVariableFilter[] = [];
    const selectedLabel = 'non_existent_label';

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, selectedLabel)
    );

    // Should return all labels (selected label not being in the list doesn't affect filtering)
    expect(result.current).toEqual(allLabels);
  });

  it('should handle complex scenario with multiple filters and selection', () => {
    const filters: AdHocVariableFilter[] = [
      { key: 'instance', operator: '=', value: 'localhost' },
      { key: 'job', operator: '!=', value: 'prometheus' },
      { key: 'service', operator: '=~', value: '.*api.*' }, // Should not filter
      { key: 'region', operator: '=', value: 'us-west-2' },
    ];
    const selectedLabel = 'job'; // Should remain visible despite != filter

    const { result } = renderHook(() =>
      useLabelFiltering(allLabels, filters, selectedLabel)
    );

    // Expected: all labels except 'instance' and 'region', but 'job' remains due to selection
    const expected = ['job', 'service', 'environment', 'custom_label'];
    expect(result.current).toEqual(expected);
  });
});
