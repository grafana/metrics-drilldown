import { COMMON_LABELS } from './constants';
import { prioritizeLabels } from './labelPriority';

describe('prioritizeLabels', () => {
  describe('basic functionality', () => {
    it('should return empty arrays for empty input', () => {
      const result = prioritizeLabels([]);

      expect(result.commonLabels).toEqual([]);
      expect(result.otherLabels).toEqual([]);
    });

    it('should separate common labels from others', () => {
      const allLabels = ['instance', 'custom_label', 'job', 'another_custom'];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toContain('instance');
      expect(result.commonLabels).toContain('job');
      expect(result.otherLabels).toContain('another_custom');
    });

    it('should maintain order of common labels as defined in COMMON_LABELS', () => {
      // Use labels in different order than COMMON_LABELS
      const allLabels = ['job', 'instance', 'service', 'environment'];
      const result = prioritizeLabels(allLabels);

      // Should follow the order in COMMON_LABELS: instance, job, service, environment
      const expectedOrder = ['instance', 'job', 'service', 'environment'];
      expect(result.commonLabels).toEqual(expectedOrder);
    });
  });

  describe('common labels handling', () => {
    it('should include all available common labels', () => {
      const allLabels = [...COMMON_LABELS, 'custom1', 'custom2'];
      const result = prioritizeLabels(allLabels);

      COMMON_LABELS.forEach(label => {
        expect(result.commonLabels).toContain(label);
      });
    });

    it('should only include common labels that exist in allLabels', () => {
      const allLabels = ['instance', 'job', 'custom_label'];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toContain('instance');
      expect(result.commonLabels).toContain('job');
      expect(result.commonLabels).not.toContain('service'); // Not in allLabels
      expect(result.commonLabels).not.toContain('environment'); // Not in allLabels
    });

    it('should handle case where no common labels are present', () => {
      const allLabels = ['custom1', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6', 'custom7'];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toEqual(['custom1', 'custom2', 'custom3', 'custom4', 'custom5']);
      expect(result.otherLabels).toEqual(['custom6', 'custom7']);
    });
  });

  describe('other labels handling', () => {
    it('should include first 5 other labels in commonLabels', () => {
      const otherLabels = ['other1', 'other2', 'other3', 'other4', 'other5', 'other6', 'other7'];
      const allLabels = ['instance', ...otherLabels];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toContain('instance');
      expect(result.commonLabels).toContain('other1');
      expect(result.commonLabels).toContain('other2');
      expect(result.commonLabels).toContain('other3');
      expect(result.commonLabels).toContain('other4');
      expect(result.commonLabels).toContain('other5');
      expect(result.commonLabels).not.toContain('other6');
      expect(result.commonLabels).not.toContain('other7');
    });

    it('should put remaining other labels in otherLabels array', () => {
      const otherLabels = ['other1', 'other2', 'other3', 'other4', 'other5', 'other6', 'other7'];
      const allLabels = ['instance', ...otherLabels];
      const result = prioritizeLabels(allLabels);

      expect(result.otherLabels).toEqual(['other6', 'other7']);
    });

    it('should maintain order of other labels', () => {
      const otherLabels = ['zebra', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
      const allLabels = [...otherLabels];
      const result = prioritizeLabels(allLabels);

      // First 5 should be in commonLabels in original order
      expect(result.commonLabels).toEqual(['zebra', 'alpha', 'beta', 'gamma', 'delta']);
      // Remaining should be in otherLabels in original order
      expect(result.otherLabels).toEqual(['epsilon', 'zeta']);
    });
  });

  describe('combined scenarios', () => {
    it('should handle mix of common and other labels correctly', () => {
      const allLabels = [
        'custom1', 'instance', 'custom2', 'job', 'custom3',
        'service', 'custom4', 'custom5', 'custom6', 'custom7'
      ];
      const result = prioritizeLabels(allLabels);

      // Should have common labels first, then first 5 others (but common labels don't count toward the 5)
      expect(result.commonLabels).toContain('instance');
      expect(result.commonLabels).toContain('job');
      expect(result.commonLabels).toContain('service');
      expect(result.commonLabels).toContain('custom1');
      expect(result.commonLabels).toContain('custom2');
      expect(result.commonLabels).toContain('custom3');
      expect(result.commonLabels).toContain('custom4');
      expect(result.commonLabels).toContain('custom5');

      expect(result.otherLabels).toEqual(['custom6', 'custom7']);
    });

    it('should handle exactly 5 other labels', () => {
      const allLabels = ['instance', 'other1', 'other2', 'other3', 'other4', 'other5'];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toEqual(['instance', 'other1', 'other2', 'other3', 'other4', 'other5']);
      expect(result.otherLabels).toEqual([]);
    });

    it('should handle fewer than 5 other labels', () => {
      const allLabels = ['instance', 'job', 'other1', 'other2'];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toEqual(['instance', 'job', 'other1', 'other2']);
      expect(result.otherLabels).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate labels', () => {
      const allLabels = ['instance', 'instance', 'job', 'custom'];
      const result = prioritizeLabels(allLabels);

      // Should handle duplicates gracefully (though input shouldn't normally have duplicates)
      expect(result.commonLabels.filter(label => label === 'instance').length).toBe(1);
    });

    it('should handle labels with special characters', () => {
      const allLabels = ['instance', 'label-with-dashes', 'label_with_underscores', 'label.with.dots'];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toContain('instance');
      expect(result.commonLabels).toContain('label-with-dashes');
      expect(result.commonLabels).toContain('label_with_underscores');
      expect(result.commonLabels).toContain('label.with.dots');
    });

    it('should handle empty string labels', () => {
      const allLabels = ['instance', '', 'job'];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toContain('instance');
      expect(result.commonLabels).toContain('job');
      expect(result.commonLabels).toContain('');
    });

    it('should handle very long label names', () => {
      const longLabel = 'this_is_a_very_long_label_name_that_might_be_used_in_some_scenarios';
      const allLabels = ['instance', longLabel];
      const result = prioritizeLabels(allLabels);

      expect(result.commonLabels).toContain('instance');
      expect(result.commonLabels).toContain(longLabel);
    });
  });

  describe('COMMON_LABELS integration', () => {
    it('should use all labels defined in COMMON_LABELS', () => {
      const result = prioritizeLabels(COMMON_LABELS);

      expect(result.commonLabels).toEqual(COMMON_LABELS);
      expect(result.otherLabels).toEqual([]);
    });

    it('should respect COMMON_LABELS order even with different input order', () => {
      // Reverse the order of common labels
      const reversedCommonLabels = [...COMMON_LABELS].reverse();
      const allLabels = [...reversedCommonLabels, 'custom'];
      const result = prioritizeLabels(allLabels);

      // Should still follow COMMON_LABELS order, not input order
      const expectedCommonLabels = [...COMMON_LABELS, 'custom'];
      expect(result.commonLabels).toEqual(expectedCommonLabels);
    });

    it('should handle partial COMMON_LABELS presence', () => {
      // Only include some common labels
      const partialCommonLabels = ['job', 'environment', 'cluster'];
      const allLabels = [...partialCommonLabels, 'custom1', 'custom2'];
      const result = prioritizeLabels(allLabels);

      // Should maintain COMMON_LABELS order for present labels
      expect(result.commonLabels[0]).toBe('job'); // First in COMMON_LABELS that's present
      expect(result.commonLabels).toContain('environment');
      expect(result.commonLabels).toContain('cluster');
      expect(result.commonLabels).toContain('custom1');
      expect(result.commonLabels).toContain('custom2');
    });
  });

  describe('return value structure', () => {
    it('should return object with correct properties', () => {
      const result = prioritizeLabels(['instance', 'custom']);

      expect(result).toHaveProperty('commonLabels');
      expect(result).toHaveProperty('otherLabels');
      expect(Array.isArray(result.commonLabels)).toBe(true);
      expect(Array.isArray(result.otherLabels)).toBe(true);
    });

    it('should ensure all input labels are accounted for', () => {
      const allLabels = ['instance', 'job', 'custom1', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6'];
      const result = prioritizeLabels(allLabels);

      const allResultLabels = [...result.commonLabels, ...result.otherLabels];
      const sortedResultLabels = [...allResultLabels].sort((a, b) => a.localeCompare(b));
      const sortedAllLabels = [...allLabels].sort((a, b) => a.localeCompare(b));
      expect(sortedResultLabels).toEqual(sortedAllLabels);
    });

    it('should not modify original input array', () => {
      const originalLabels = ['instance', 'custom1', 'job'];
      const labelsCopy = [...originalLabels];

      prioritizeLabels(originalLabels);

      expect(originalLabels).toEqual(labelsCopy);
    });
  });
});
