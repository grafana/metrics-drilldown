import { css, cx } from '@emotion/css';
import { VariableHide, type GrafanaTheme2 } from '@grafana/data';
import { CustomVariable, type MultiValueVariable, type MultiValueVariableState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

export const VAR_MAIN_LABEL_VARIABLE = 'mainLabelWingman';

export class MainLabelVariable extends CustomVariable {
  private static OPTIONS = [
    { label: 'Cluster', value: 'cluster' },
    { label: 'Environment', value: 'environment' },
    { label: 'Job', value: 'job' },
    { label: 'Namespace', value: 'namespace' },
    { label: 'Service', value: 'service' },
  ];

  constructor() {
    super({
      name: VAR_MAIN_LABEL_VARIABLE,
      query: MainLabelVariable.OPTIONS.map((option) => option.value).join(','),
      hide: VariableHide.hideLabel,
      value: undefined,
    });
  }

  static Component = ({ model }: { model: MultiValueVariable<MultiValueVariableState> }) => {
    const styles = useStyles2(getStyles);
    const { options, value } = model.useState();

    const toggle = (newValue: any) => () => {
      model.changeValueTo(newValue === value ? '' : newValue);
    };

    return (
      <div className={styles.container}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            className={cx(styles.labelButton, { [styles.selected]: option.value === value })}
            onClick={toggle(option.value)}
            title={`Group metrics by ${option.label}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(2)};
    `,
    labelButton: css`
      flex: 0 0 200px;
      height: 80px;
      font-size: 16px;
      text-align: center;
      margin: 0;

      box-sizing: border-box;
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: 8px;
      padding: ${theme.spacing(2)};
      transition: all 0.2s ease-in-out;

      &:hover {
        background-color: ${theme.colors.background.secondary};
        border-color: ${theme.colors.border.medium};
      }
    `,
    selected: css`
      border: 1px solid ${theme.colors.primary.main};
      background-color: ${theme.colors.background.primary};

      &:hover {
        background-color: ${theme.colors.background.primary};
        border-color: ${theme.colors.primary.main};
      }
    `,
  };
}
