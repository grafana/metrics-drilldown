import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Text, useStyles2 } from '@grafana/ui';
import React from 'react';

export const CheckboxWithCount = ({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.checkboxWrapper} title={label}>
      <Checkbox label={label} value={checked} onChange={onChange} />
      <span className={styles.count}>
        <Text variant="body" color="secondary">
          ({count})
        </Text>
      </span>
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
    count: css({
      marginLeft: theme.spacing(0.5),
    }),
  };
}
