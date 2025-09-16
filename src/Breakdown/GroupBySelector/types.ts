import { type SelectableValue } from '@grafana/data';
export interface AttributePrefixConfig {
  span?: string;
  resource?: string;
  event?: string;
  [key: string]: string | undefined;
}
export interface SearchConfig {
  enabled?: boolean;
  maxOptions?: number;
  caseSensitive?: boolean;
  searchFields?: Array<'label' | 'value'>;
}

export interface GroupBySelectorProps {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string, ignore?: boolean) => void;
  showAll?: boolean;
  attributePrefixes?: AttributePrefixConfig;
  fieldLabel?: string;
  selectPlaceholder?: string;
  ignoredAttributes?: string[];
  searchConfig?: SearchConfig;
}
