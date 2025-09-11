import { type SelectableValue } from '@grafana/data';

/**
 * Configuration for a single filter
 */
export interface FilterConfig {
  key: string;
  operator: string;
  value: string;
}

/**
 * Configuration for attribute prefixes used in label display
 */
export interface AttributePrefixConfig {
  span?: string;
  resource?: string;
  event?: string;
  [key: string]: string | undefined;
}

/**
 * Context provided to filtering functions
 */
export interface FilterContext {
  filters: FilterConfig[];
  currentMetric?: string;
  availableOptions: Array<SelectableValue<string>>;
}

/**
 * Configuration for attribute filtering rules
 */
export interface FilteringRulesConfig {
  /** Exclude attributes from radio buttons when they're in active filters */
  excludeFilteredFromRadio?: boolean;

  /** Exclude specific attributes when certain metrics are selected */
  excludeAttributesForMetrics?: Record<string, string[]>;

  /** Exclude specific attributes when certain filters are active */
  excludeAttributesForFilters?: Record<string, string[]>;

  /** Custom filtering function for advanced use cases */
  customAttributeFilter?: (attribute: string, context: FilterContext) => boolean;
}

/**
 * Configuration for layout and sizing
 */
export interface LayoutConfig {
  /** Additional width per radio button item */
  additionalWidthPerItem?: number;

  /** Width reserved for the select dropdown */
  widthOfOtherAttributes?: number;

  /** Maximum width for the select component */
  maxSelectWidth?: number;

  /** Enable responsive radio button visibility based on available width */
  enableResponsiveRadioButtons?: boolean;
}

/**
 * Configuration for search functionality
 */
export interface SearchConfig {
  /** Enable search functionality in the select dropdown */
  enabled?: boolean;

  /** Maximum number of options to display */
  maxOptions?: number;

  /** Case sensitive search */
  caseSensitive?: boolean;

  /** Fields to search in */
  searchFields?: Array<'label' | 'value'>;
}

/**
 * Configuration for virtualization
 */
export interface VirtualizationConfig {
  /** Enable virtualization for large option lists */
  enabled?: boolean;

  /** Height of each item in pixels */
  itemHeight?: number;

  /** Maximum height of the dropdown */
  maxHeight?: number;
}

/**
 * Processed attribute with display information
 */
export interface ProcessedAttribute {
  label: string;
  text: string;
  value: string;
}

/**
 * Configuration for radio attribute processing
 */
export interface RadioProcessingConfig {
  attributePrefixes: AttributePrefixConfig;
  fontSize: number;
  availableWidth: number;
  additionalWidthPerItem: number;
  widthOfOtherAttributes: number;
}

/**
 * Main props interface for GroupBySelector
 */
export interface GroupBySelectorProps {
  // Core Selection Interface
  /** Available attribute options for selection */
  readonly options: Array<SelectableValue<string>>;

  /** Attributes to show as radio buttons */
  readonly radioAttributes: string[];

  /** Currently selected attribute */
  readonly value?: string;

  /** Selection change handler */
  readonly onChange: (label: string, ignore?: boolean) => void;

  /** Whether to show "All" option */
  readonly showAll?: boolean;

  // State Data (previously from scene graph)
  /** Active filters for exclusion logic */
  readonly filters?: FilterConfig[];

  /** Current metric for conditional filtering */
  readonly currentMetric?: string;

  /** Initial selection value */
  readonly initialGroupBy?: string;

  // Display Configuration
  /** Attribute prefix configuration for label display */
  readonly attributePrefixes?: AttributePrefixConfig;

  /** Field label text */
  readonly fieldLabel?: string;

  /** Select placeholder text */
  readonly selectPlaceholder?: string;

  // Filtering Rules Configuration
  /** Attribute filtering rules */
  readonly filteringRules?: FilteringRulesConfig;

  /** Attributes to exclude from options */
  readonly ignoredAttributes?: string[];

  // Layout and Sizing
  /** Layout and sizing configuration */
  readonly layoutConfig?: LayoutConfig;

  // Advanced Options
  /** Search functionality configuration */
  readonly searchConfig?: SearchConfig;

  /** Virtualization settings */
  readonly virtualizationConfig?: VirtualizationConfig;
}

/**
 * Configuration interface for GroupBySelector
 */
export interface DomainConfig {
  attributePrefixes: AttributePrefixConfig;
  filteringRules: FilteringRulesConfig;
  ignoredAttributes: string[];
  layoutConfig: LayoutConfig;
  searchConfig: SearchConfig;
  virtualizationConfig: VirtualizationConfig;
}
