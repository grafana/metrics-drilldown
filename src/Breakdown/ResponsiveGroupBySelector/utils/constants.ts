// Responsive constants for calculating radio button visibility
export const RESPONSIVE_CONSTANTS = {
  additionalWidthPerItem: 40,      // Padding/margins per radio button
  widthOfDropdown: 180,            // Reserved space for dropdown
  minContainerWidth: 300,          // Minimum width before hiding all radios
  radioButtonPadding: 16,          // Internal button padding
  allButtonWidth: 100,             // Width reserved for "All Labels" button
};

// Common labels that should be prioritized for radio button display
export const COMMON_LABELS = [
  'instance', 'job', 'service', 'environment', 'region',
  'namespace', 'pod', 'container', 'node', 'cluster',
  'app', 'application', 'version', 'stage', 'zone'
];

// Default font size for text measurement
export const DEFAULT_FONT_SIZE = 14;
