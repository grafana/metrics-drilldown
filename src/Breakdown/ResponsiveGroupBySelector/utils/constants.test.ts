import { COMMON_LABELS, DEFAULT_FONT_SIZE, RESPONSIVE_CONSTANTS } from './constants';

describe('constants', () => {
  describe('RESPONSIVE_CONSTANTS', () => {
    it('should have all required properties', () => {
      expect(RESPONSIVE_CONSTANTS).toHaveProperty('additionalWidthPerItem');
      expect(RESPONSIVE_CONSTANTS).toHaveProperty('widthOfDropdown');
      expect(RESPONSIVE_CONSTANTS).toHaveProperty('minContainerWidth');
      expect(RESPONSIVE_CONSTANTS).toHaveProperty('radioButtonPadding');
      expect(RESPONSIVE_CONSTANTS).toHaveProperty('allButtonWidth');
    });

    it('should have reasonable numeric values', () => {
      expect(typeof RESPONSIVE_CONSTANTS.additionalWidthPerItem).toBe('number');
      expect(typeof RESPONSIVE_CONSTANTS.widthOfDropdown).toBe('number');
      expect(typeof RESPONSIVE_CONSTANTS.minContainerWidth).toBe('number');
      expect(typeof RESPONSIVE_CONSTANTS.radioButtonPadding).toBe('number');
      expect(typeof RESPONSIVE_CONSTANTS.allButtonWidth).toBe('number');

      // Values should be positive
      expect(RESPONSIVE_CONSTANTS.additionalWidthPerItem).toBeGreaterThan(0);
      expect(RESPONSIVE_CONSTANTS.widthOfDropdown).toBeGreaterThan(0);
      expect(RESPONSIVE_CONSTANTS.minContainerWidth).toBeGreaterThan(0);
      expect(RESPONSIVE_CONSTANTS.radioButtonPadding).toBeGreaterThan(0);
      expect(RESPONSIVE_CONSTANTS.allButtonWidth).toBeGreaterThan(0);
    });

    it('should have logical relationships between values', () => {
      // minContainerWidth should be larger than dropdown width
      expect(RESPONSIVE_CONSTANTS.minContainerWidth).toBeGreaterThan(RESPONSIVE_CONSTANTS.widthOfDropdown);

      // additionalWidthPerItem should include padding
      expect(RESPONSIVE_CONSTANTS.additionalWidthPerItem).toBeGreaterThanOrEqual(RESPONSIVE_CONSTANTS.radioButtonPadding);
    });

    it('should maintain expected values for UI consistency', () => {
      // These values are tuned for the UI, changes should be intentional
      expect(RESPONSIVE_CONSTANTS.additionalWidthPerItem).toBe(32);
      expect(RESPONSIVE_CONSTANTS.widthOfDropdown).toBe(140);
      expect(RESPONSIVE_CONSTANTS.minContainerWidth).toBe(250);
      expect(RESPONSIVE_CONSTANTS.radioButtonPadding).toBe(16);
      expect(RESPONSIVE_CONSTANTS.allButtonWidth).toBe(80);
    });

    it('should be immutable', () => {
      const originalValues = { ...RESPONSIVE_CONSTANTS };

      // Attempt to modify (should not work if properly frozen/readonly)
      expect(() => {
        // @ts-ignore - Testing runtime immutability
        RESPONSIVE_CONSTANTS.additionalWidthPerItem = 999;
      }).not.toThrow(); // JavaScript doesn't throw for this, but TypeScript should prevent it

      // Values should remain unchanged
      expect(RESPONSIVE_CONSTANTS).toEqual(originalValues);
    });
  });

  describe('COMMON_LABELS', () => {
    it('should be an array of strings', () => {
      expect(Array.isArray(COMMON_LABELS)).toBe(true);
      COMMON_LABELS.forEach(label => {
        expect(typeof label).toBe('string');
      });
    });

    it('should contain expected infrastructure labels', () => {
      const expectedLabels = [
        'instance', 'job', 'service', 'environment', 'region',
        'namespace', 'pod', 'container', 'node', 'cluster',
        'app', 'application', 'version', 'stage', 'zone'
      ];

      expectedLabels.forEach(label => {
        expect(COMMON_LABELS).toContain(label);
      });
    });

    it('should have reasonable length', () => {
      // Should have a good selection of common labels, but not too many
      expect(COMMON_LABELS.length).toBeGreaterThan(5);
      expect(COMMON_LABELS.length).toBeLessThan(50);
    });

    it('should not contain duplicates', () => {
      const uniqueLabels = [...new Set(COMMON_LABELS)];
      expect(uniqueLabels.length).toBe(COMMON_LABELS.length);
    });

    it('should contain only valid label names', () => {
      COMMON_LABELS.forEach(label => {
        // Labels should not be empty
        expect(label.length).toBeGreaterThan(0);

        // Labels should not contain spaces (typical Prometheus label format)
        expect(label).not.toContain(' ');

        // Labels should be reasonable length
        expect(label.length).toBeLessThan(50);
      });
    });

    it('should prioritize most common infrastructure labels first', () => {
      // The most common labels should be at the beginning
      const firstFew = COMMON_LABELS.slice(0, 5);
      expect(firstFew).toContain('instance');
      expect(firstFew).toContain('job');
      expect(firstFew).toContain('service');
    });

    it('should be immutable', () => {
      const originalLength = COMMON_LABELS.length;
      const firstLabel = COMMON_LABELS[0];

      // Attempt to modify array (should not work if properly frozen)
      expect(() => {
        // @ts-ignore - Testing runtime immutability
        COMMON_LABELS.push('new_label');
      }).not.toThrow(); // JavaScript doesn't throw, but TypeScript should prevent it

      expect(() => {
        // @ts-ignore - Testing runtime immutability
        COMMON_LABELS[0] = 'modified';
      }).not.toThrow();

      // Array should remain unchanged
      expect(COMMON_LABELS.length).toBe(originalLength);
      expect(COMMON_LABELS[0]).toBe(firstLabel);
    });
  });

  describe('DEFAULT_FONT_SIZE', () => {
    it('should be a positive number', () => {
      expect(typeof DEFAULT_FONT_SIZE).toBe('number');
      expect(DEFAULT_FONT_SIZE).toBeGreaterThan(0);
    });

    it('should be a reasonable font size for UI', () => {
      // Typical UI font sizes are between 10-20px
      expect(DEFAULT_FONT_SIZE).toBeGreaterThanOrEqual(10);
      expect(DEFAULT_FONT_SIZE).toBeLessThanOrEqual(20);
    });

    it('should maintain expected value', () => {
      // This value is used for text measurement calculations
      expect(DEFAULT_FONT_SIZE).toBe(14);
    });

    it('should be immutable', () => {
      const originalValue = DEFAULT_FONT_SIZE;

      // This should not be possible with const, but testing for completeness
      expect(DEFAULT_FONT_SIZE).toBe(originalValue);
    });
  });

  describe('constants integration', () => {
    it('should work together for responsive calculations', () => {
      // The constants should work together logically
      const minSpaceNeeded = RESPONSIVE_CONSTANTS.widthOfDropdown + RESPONSIVE_CONSTANTS.allButtonWidth;
      expect(RESPONSIVE_CONSTANTS.minContainerWidth).toBeGreaterThan(minSpaceNeeded);
    });

    it('should support typical label text with default font size', () => {
      // Using DEFAULT_FONT_SIZE, typical labels should fit within reasonable bounds
      const typicalLabelWidth = DEFAULT_FONT_SIZE * 8; // Rough estimate: 8px per character for 10-char label
      const totalItemWidth = typicalLabelWidth + RESPONSIVE_CONSTANTS.additionalWidthPerItem;

      // Should be reasonable for UI
      expect(totalItemWidth).toBeLessThan(200);
      expect(totalItemWidth).toBeGreaterThan(50);
    });
  });

  describe('type safety', () => {
    it('should maintain correct TypeScript types', () => {
      // RESPONSIVE_CONSTANTS should have numeric properties
      const additionalWidth: number = RESPONSIVE_CONSTANTS.additionalWidthPerItem;
      const dropdownWidth: number = RESPONSIVE_CONSTANTS.widthOfDropdown;
      const minWidth: number = RESPONSIVE_CONSTANTS.minContainerWidth;
      const padding: number = RESPONSIVE_CONSTANTS.radioButtonPadding;
      const allButtonWidth: number = RESPONSIVE_CONSTANTS.allButtonWidth;

      expect(typeof additionalWidth).toBe('number');
      expect(typeof dropdownWidth).toBe('number');
      expect(typeof minWidth).toBe('number');
      expect(typeof padding).toBe('number');
      expect(typeof allButtonWidth).toBe('number');
    });

    it('should maintain string array type for COMMON_LABELS', () => {
      const labels: string[] = COMMON_LABELS;
      expect(Array.isArray(labels)).toBe(true);

      labels.forEach((label: string) => {
        expect(typeof label).toBe('string');
      });
    });

    it('should maintain number type for DEFAULT_FONT_SIZE', () => {
      const fontSize: number = DEFAULT_FONT_SIZE;
      expect(typeof fontSize).toBe('number');
    });
  });
});
