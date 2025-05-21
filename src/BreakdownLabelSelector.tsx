import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Combobox, useStyles2 } from '@grafana/ui';
import React from 'react';

type Props = {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string | undefined) => void;
};

export function BreakdownLabelSelector({ options, value, onChange }: Readonly<Props>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.select} data-testid="breakdown-label-selector">
      <Combobox
        options={options.map((opt) => ({ label: opt.label || '', value: opt.value || '' }))}
        value={value || ''}
        onChange={(selected) => onChange(selected?.value)}
        width={16}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css({
      maxWidth: theme.spacing(16),
    }),
  };
}
