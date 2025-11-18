import { SceneVariableValueChangedEvent, type QueryVariable, type VariableValueOption } from '@grafana/scenes';
import { cloneDeep, isEqual } from 'lodash';

import { HIERARCHICAL_SEPARATOR } from './computeMetricPrefixSecondLevel';
import { type MetricOptions } from './MetricsVariable';

export type MetricFilters = {
  categories: string[];
  prefixes: string[];
  suffixes: string[];
  names: string[];
};

export class MetricsVariableFilterEngine {
  private variable: QueryVariable;
  private initOptions: VariableValueOption[] = [];
  private filters: MetricFilters = {
    categories: [],
    prefixes: [],
    suffixes: [],
    names: [],
  };

  constructor(variable: QueryVariable) {
    this.variable = variable;
  }

  public setInitOptions(options: VariableValueOption[]) {
    this.initOptions = cloneDeep(options);
  }

  /**
   * Get a copy of the current filters
   */
  public getFilters(): MetricFilters {
    return this.filters;
  }

  /**
   * Compute options based on filters.
   * @param options The options to filter
   * @param filters The filters to apply
   * @returns Filtered options
   */
  public static getFilteredOptions(options: VariableValueOption[], filters: MetricFilters): MetricOptions {
    let filteredOptions = options as MetricOptions;

    if (filters.categories.length > 0) {
      filteredOptions = MetricsVariableFilterEngine.applyCategoryFilters(filteredOptions, filters.categories);
    }

    if (filters.prefixes.length > 0) {
      filteredOptions = MetricsVariableFilterEngine.applyPrefixFilters(filteredOptions, filters.prefixes);
    }

    if (filters.suffixes.length > 0) {
      filteredOptions = MetricsVariableFilterEngine.applySuffixFilters(filteredOptions, filters.suffixes);
    }

    if (filters.names.length > 0) {
      filteredOptions = MetricsVariableFilterEngine.applyNameFilters(filteredOptions, filters.names);
    }

    return filteredOptions;
  }

  public applyFilters(filters: Partial<MetricFilters> = this.filters, settings = { forceUpdate: false, notify: true }) {
    const updatedFilters: MetricFilters = {
      ...this.filters,
      ...filters,
    };

    if (!settings.forceUpdate && isEqual(this.filters, updatedFilters)) {
      return;
    }

    if (
      !updatedFilters.categories.length &&
      !updatedFilters.prefixes.length &&
      !updatedFilters.suffixes.length &&
      !updatedFilters.names.length
    ) {
      this.filters = updatedFilters;

      this.variable.setState({ options: this.initOptions });

      if (settings.notify) {
        this.notifyUpdate();
      }

      return;
    }

    this.filters = updatedFilters;

    const filteredOptions = MetricsVariableFilterEngine.getFilteredOptions(this.initOptions, this.filters);

    this.variable.setState({ options: filteredOptions });

    if (settings.notify) {
      this.notifyUpdate();
    }
  }

  private static applyCategoryFilters(options: MetricOptions, categories: string[]): MetricOptions {
    let filteredOptions: MetricOptions = [];

    for (const category of categories) {
      const categoryRegex = MetricsVariableFilterEngine.buildRegex(category, 'i'); // see e.g. computeRulesGroups (could apply to other categories in the future)
      filteredOptions = filteredOptions.concat(options.filter((option) => categoryRegex.test(option.value)));
    }

    return filteredOptions;
  }

  private static applyPrefixFilters(options: MetricOptions, prefixes: string[]): MetricOptions {
    const pattern = prefixes
      .map((prefix) => {
        // Check if this is hierarchical (contains colon separator)
        if (prefix.includes(HIERARCHICAL_SEPARATOR)) {
          const [level0, level1] = prefix.split(HIERARCHICAL_SEPARATOR);
          // Match: ^level0[separator]level1[separator or end]
          // Example: grafana:alert → ^grafana[^a-z0-9]alert([^a-z0-9]|$)
          return `^${level0}[^a-z0-9]${level1}([^a-z0-9]|$)`;
        }

        // Multi-value support (see computeMetricPrefixGroups)
        if (prefix.includes('|')) {
          return `${prefix
            .split('|')
            .map((p) => `^${p}([^a-z0-9]|$)`)
            .join('|')}`;
        }

        // Regular Level 0 prefix
        return `^${prefix}([^a-z0-9]|$)`;
      })
      .join('|');

    const prefixesRegex = MetricsVariableFilterEngine.buildRegex(`(${pattern})`);

    const filteredOptions = options.filter((option) => prefixesRegex.test(option.value as string));

    return filteredOptions;
  }

  private static applySuffixFilters(options: MetricOptions, suffixes: string[]): MetricOptions {
    const pattern = suffixes
      .map((suffix) => {
        // Multi-value support (see computeMetricSuffixGroups)
        if (suffix.includes('|')) {
          return `${suffix
            .split('|')
            .map((s) => `(^|[^a-z0-9])${s}$`)
            .join('|')}`;
        }

        return `(^|[^a-z0-9])${suffix}$`;
      })
      .join('|');

    const suffixesRegex = MetricsVariableFilterEngine.buildRegex(`(${pattern})`);

    const filteredOptions = options.filter((option) => suffixesRegex.test(option.value as string));

    return filteredOptions;
  }

  private static applyNameFilters(options: MetricOptions, names: string[]): MetricOptions {
    const [namePatterns] = names;

    const regexes = namePatterns
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((r) => {
        try {
          return new RegExp(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as RegExp[];

    return options.filter((option) => regexes.some((regex) => regex.test(option.value as string)));
  }

  private static buildRegex(pattern: string, flags?: string) {
    try {
      return new RegExp(pattern, flags);
    } catch {
      return new RegExp('.*');
    }
  }

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }
}
