import { type SelectableValue } from '@grafana/data';

/**
 * Configuration for attribute prefixes used in label display
 */
export interface AttributePrefixConfig {
  span?: string;
  resource?: string;
  event?: string;
  [key: string]: string | undefined;
}

// (no filtering/layout configs needed anymore)

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

// (no virtualization config needed anymore)

// (no processed attribute or radio processing configs needed)

/**
 * Main props interface for GroupBySelector
 */
export interface GroupBySelectorProps {
  // Core Selection Interface
  /** Available attribute options for selection */
  readonly options: Array<SelectableValue<string>>;

  /** Currently selected attribute */
  readonly value?: string;

  /** Selection change handler */
  readonly onChange: (label: string, ignore?: boolean) => void;

  /** Whether to show "All" option */
  readonly showAll?: boolean;

  // Display Configuration
  /** Attribute prefix configuration for label display */
  readonly attributePrefixes?: AttributePrefixConfig;

  /** Field label text */
  readonly fieldLabel?: string;

  /** Select placeholder text */
  readonly selectPlaceholder?: string;

  /** Attributes to exclude from options */
  readonly ignoredAttributes?: string[];

  /** Search functionality configuration */
  readonly searchConfig?: SearchConfig;
}
// (no DomainConfig)
