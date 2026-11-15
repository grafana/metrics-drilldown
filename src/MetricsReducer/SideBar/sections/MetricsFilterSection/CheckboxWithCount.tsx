import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Checkbox, useStyles2 } from '@grafana/ui';
import React, { useId } from 'react';

export const CheckboxWithCount = ({
  label,
  count,
  checked,
  onChange,
  icon,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
}) => {
  const styles = useStyles2(getStyles);
  const checkboxId = useId();

  return (
    <div className={styles.checkboxWrapper} title={label}>
      {icon ? (
        // The checkbox label only takes text, so with an icon the label is rendered here, after the checkbox
        <>
          <Checkbox id={checkboxId} checked={checked} onChange={onChange} />
          <label htmlFor={checkboxId} className={styles.iconLabel}>
            {icon}
            <span>{label}</span>
          </label>
        </>
      ) : (
        <Checkbox label={label} checked={checked} onChange={onChange} />
      )}
      <span className={styles.count}>({count})</span>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    checkboxWrapper: css({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      '& label *': {
        fontSize: '14px !important',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
    iconLabel: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
      marginLeft: theme.spacing(1),
      cursor: 'pointer',
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    count: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(0.5),
      display: 'inline-block',
    }),
  };
}
