// Responsive constants for calculating radio button visibility
export const RESPONSIVE_CONSTANTS = {
  additionalWidthPerItem: 32,      // padding/margins per radio button
  widthOfDropdown: 140,            // reserved space for dropdown
  minContainerWidth: 250,          // minimum width before hiding all radios
  radioButtonPadding: 16,          // Internal button padding
  allButtonWidth: 80,              // width reserved for "All Labels" button
};

// Common labels that should be prioritized for radio button display
export const COMMON_LABELS = [
  'instance', 'job', 'service', 'environment', 'region',
  'namespace', 'pod', 'container', 'node', 'cluster',
  'app', 'application', 'version', 'stage', 'zone'
];

// Default font size for text measurement
export const DEFAULT_FONT_SIZE = 14;
