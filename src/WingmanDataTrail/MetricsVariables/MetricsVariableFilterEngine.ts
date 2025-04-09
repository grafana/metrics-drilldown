import { SceneVariableValueChangedEvent, type MultiValueVariable, type VariableValueOption } from '@grafana/scenes';
import { cloneDeep, isEqual } from 'lodash';

import { type MetricOptions } from './MetricsVariable';

export type MetricFilters = {
  prefixes: string[];
  suffixes: string[];
  names: string[];
};

export class MetricsVariableFilterEngine {
  private variable: MultiValueVariable;
  private initOptions: VariableValueOption[] = [];
  private filters: MetricFilters = {
    prefixes: [],
    suffixes: [],
    names: [],
  };

  constructor(variable: MultiValueVariable) {
    this.variable = variable;
  }

  public setInitOptions(options: VariableValueOption[]) {
    this.initOptions = cloneDeep(options);
  }

  public applyFilters(filters: Partial<MetricFilters> = this.filters, notify = true, forceUpdate = false) {
    const updatedFilters = {
      ...this.filters,
      ...filters,
    };

    if (
      !forceUpdate &&
      (isEqual(this.filters, updatedFilters) ||
        (!updatedFilters.names.length && !updatedFilters.prefixes.length && !updatedFilters.suffixes.length))
    ) {
      this.filters = updatedFilters;

      this.variable.setState({ options: this.initOptions });

      if (notify) {
        this.notifyUpdate();
      }

      return;
    }

    const allOptions = this.initOptions;
    let filteredOptions = allOptions as MetricOptions;

    if (updatedFilters.prefixes.length > 0) {
      filteredOptions = this.applyPrefixFilters(filteredOptions, updatedFilters.prefixes);
    }

    if (updatedFilters.suffixes.length > 0) {
      filteredOptions = this.applySuffixFilters(filteredOptions, updatedFilters.suffixes);
    }

    if (updatedFilters.names.length > 0) {
      filteredOptions = this.applyNamesFilters(filteredOptions, updatedFilters.names);
    }

    this.filters = updatedFilters;

    this.variable.setState({ options: filteredOptions });

    if (notify) {
      this.notifyUpdate();
    }
  }

  private applyPrefixFilters(options: MetricOptions, prefixes: string[]): MetricOptions {
    const pattern = prefixes
      .map((prefix) => {
        // catch-all (see computeMetricPrefixGroups)
        if (prefix.includes('|')) {
          return `${prefix
            .split('|')
            .map((p) => `^${p}$`)
            .join('|')}`;
        }

        return `^${prefix}.+`;
      })
      .join('|');

    const prefixesRegex = MetricsVariableFilterEngine.buildRegex(`(${pattern})`);

    return options.filter((option) => prefixesRegex.test(option.value as string));
  }

  private applySuffixFilters(options: MetricOptions, suffixes: string[]): MetricOptions {
    const pattern = suffixes
      .map((suffix) => {
        // catch-all (see computeMetricSuffixGroups)
        if (suffix.includes('|')) {
          return `${suffix
            .split('|')
            .map((s) => `^${s}$`)
            .join('|')}`;
        }

        return `.+${suffix}$`;
      })
      .join('|');

    const suffixesRegex = MetricsVariableFilterEngine.buildRegex(`(${pattern})`);

    return options.filter((option) => suffixesRegex.test(option.value as string));
  }

  private applyNamesFilters(options: MetricOptions, names: string[]): MetricOptions {
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

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }

  private static buildRegex(pattern: string, flags?: string) {
    try {
      return new RegExp(pattern, flags);
    } catch {
      return new RegExp('.*');
    }
  }
}
