import { RESPONSIVE_CONSTANTS } from './constants';
import { calculateVisibleRadioOptions } from './widthCalculations';

describe('calculateVisibleRadioOptions', () => {
  const mockMeasureText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: return text length * 8 as width
    mockMeasureText.mockImplementation((text: string) => text.length * 8);
  });

  describe('basic functionality', () => {
    it('should return empty arrays for empty input', () => {
      const result = calculateVisibleRadioOptions([], 800, mockMeasureText);

      expect(result.visibleLabels).toEqual([]);
      expect(result.hiddenLabels).toEqual([]);
    });

    it('should handle single label that fits', () => {
      const labels = ['instance'];
      const availableWidth = 500;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(result.visibleLabels).toEqual(['instance']);
      expect(result.hiddenLabels).toEqual([]);
    });

    it('should hide labels that do not fit', () => {
      const labels = ['very_long_label_name_that_should_not_fit', 'short'];
      const availableWidth = 200;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(result.visibleLabels).toEqual([]);
      expect(result.hiddenLabels).toEqual(['very_long_label_name_that_should_not_fit', 'short']);
    });
  });

  describe('width calculations', () => {
    it('should account for additional width per item', () => {
      // Mock short text that should fit individually but not with padding
      mockMeasureText.mockImplementation(() => 50);

      const labels = ['a', 'b', 'c', 'd', 'e'];
      const availableWidth = 400;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // With additional width per item (32px) + dropdown width (140px) + "All Labels" (~72px)
      // Each item needs ~82px (50 + 32), "All Labels" ~104px (32 + 72)
      // Total budget: 400 - 140 = 260px for radio buttons
      // "All Labels": 104px, remaining: 156px
      // Should fit 1-2 additional labels max
      expect(result.visibleLabels.length).toBeLessThan(5);
      expect(result.hiddenLabels.length).toBeGreaterThan(0);
    });

    it('should reserve space for dropdown', () => {
      mockMeasureText.mockImplementation(() => 30);

      const labels = ['label1', 'label2'];
      const availableWidth = RESPONSIVE_CONSTANTS.widthOfDropdown + 100; // Just enough for dropdown + small buffer

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // Should account for dropdown space reservation
      expect(result.hiddenLabels.length).toBeGreaterThan(0);
    });

    it('should include "All Labels" width in calculations', () => {
      // The function should account for "All Labels" button width
      mockMeasureText.mockReturnValueOnce(72); // "All Labels" width
      mockMeasureText.mockImplementation(() => 50); // Other labels

      const labels = ['label1'];
      const availableWidth = 300;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(mockMeasureText).toHaveBeenCalledWith('All Labels');
      expect(result.visibleLabels).toContain('label1');
    });
  });

  describe('responsive behavior', () => {
    it('should hide all labels when container is too small', () => {
      const labels = ['instance', 'job', 'service'];
      const availableWidth = RESPONSIVE_CONSTANTS.minContainerWidth - 1;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(result.visibleLabels).toEqual([]);
      expect(result.hiddenLabels).toEqual(labels);
    });

    it('should use default width when availableWidth is 0', () => {
      const labels = ['instance', 'job'];
      const availableWidth = 0;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // Should behave as if width is 600 (default)
      expect(result.visibleLabels.length).toBeGreaterThan(0);
    });

    it('should handle negative availableWidth', () => {
      const labels = ['instance'];
      const availableWidth = -100;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // Should use effective width (600) instead of negative value
      expect(result.visibleLabels).toContain('instance');
    });
  });

  describe('label ordering', () => {
    it('should maintain label order in visible and hidden arrays', () => {
      const labels = ['first', 'second', 'third', 'fourth'];
      const availableWidth = 300; // Limited width

      mockMeasureText.mockImplementation((text: string) => {
        // Make first two labels short, last two long
        return text.includes('first') || text.includes('second') ? 20 : 100;
      });

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // Should maintain order
      expect(result.visibleLabels).toEqual(['first', 'second']);
      expect(result.hiddenLabels).toEqual(['third', 'fourth']);
    });

    it('should process labels in order until width limit is reached', () => {
      const labels = ['a', 'b', 'c', 'd'];
      const availableWidth = 250;

      // Each label is 40px + 32px padding = 72px per label
      // "All Labels" is 72px + 32px = 104px
      // Dropdown reserve: 140px
      // Available for labels: 250 - 140 = 110px
      // After "All Labels": 110 - 104 = 6px (not enough for any additional label)
      mockMeasureText.mockImplementation((text: string) => {
        return text === 'All Labels' ? 72 : 40;
      });

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(result.visibleLabels).toEqual([]);
      expect(result.hiddenLabels).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('edge cases', () => {
    it('should handle very long label names', () => {
      const longLabel = 'this_is_an_extremely_long_label_name_that_should_definitely_not_fit_in_any_reasonable_width';
      const labels = [longLabel, 'short'];
      const availableWidth = 800;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(result.hiddenLabels).toContain(longLabel);
    });

    it('should handle many labels', () => {
      const labels = Array.from({ length: 50 }, (_, i) => `label${i}`);
      const availableWidth = 1200;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(result.visibleLabels.length + result.hiddenLabels.length).toBe(50);
      expect(result.visibleLabels.length).toBeGreaterThan(0);
      expect(result.hiddenLabels.length).toBeGreaterThan(0);
    });

    it('should handle labels with special characters', () => {
      const labels = ['label-with-dashes', 'label_with_underscores', 'label.with.dots', 'label:with:colons'];
      const availableWidth = 800;

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      const allLabels = [...result.visibleLabels, ...result.hiddenLabels];
      expect(allLabels).toEqual(labels);
    });

    it('should handle empty strings in labels', () => {
      const labels = ['', 'normal_label', ''];
      const availableWidth = 500;

      mockMeasureText.mockImplementation((text: string) => {
        return text.length * 8; // Empty strings return 0
      });

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect([...result.visibleLabels, ...result.hiddenLabels]).toEqual(labels);
    });
  });

  describe('constants usage', () => {
    it('should use RESPONSIVE_CONSTANTS values', () => {
      const labels = ['test'];
      const availableWidth = RESPONSIVE_CONSTANTS.minContainerWidth;

      // At exactly minContainerWidth, should still work
      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      expect(result.visibleLabels.length + result.hiddenLabels.length).toBe(1);
    });

    it('should respect additionalWidthPerItem constant', () => {
      mockMeasureText.mockImplementation(() => 50);

      const labels = ['test'];
      const availableWidth = 50 + RESPONSIVE_CONSTANTS.additionalWidthPerItem + RESPONSIVE_CONSTANTS.widthOfDropdown + 100; // Just enough

      const result = calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // Should be able to fit the label with additional width accounted for
      expect(result.visibleLabels).toContain('test');
    });
  });

  describe('performance considerations', () => {
    it('should call measureText for each label and "All Labels"', () => {
      const labels = ['label1', 'label2', 'label3'];
      const availableWidth = 800;

      calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // Should call measureText for "All Labels" + each label
      expect(mockMeasureText).toHaveBeenCalledTimes(4);
      expect(mockMeasureText).toHaveBeenCalledWith('All Labels');
      expect(mockMeasureText).toHaveBeenCalledWith('label1');
      expect(mockMeasureText).toHaveBeenCalledWith('label2');
      expect(mockMeasureText).toHaveBeenCalledWith('label3');
    });

    it('should stop processing when width limit is reached', () => {
      const labels = ['short', 'another', 'very_long_label_that_wont_fit', 'not_processed'];
      const availableWidth = 200;

      mockMeasureText.mockImplementation((text: string) => {
        if (text === 'All Labels') {
          return 72;
        }
        if (text === 'very_long_label_that_wont_fit') {
          return 200;
        }
        return 30;
      });

      calculateVisibleRadioOptions(labels, availableWidth, mockMeasureText);

      // Should not call measureText for labels after the width limit is exceeded
      expect(mockMeasureText).toHaveBeenCalled();
      expect(mockMeasureText).not.toHaveBeenCalledWith('not_processed');
    });
  });
});
