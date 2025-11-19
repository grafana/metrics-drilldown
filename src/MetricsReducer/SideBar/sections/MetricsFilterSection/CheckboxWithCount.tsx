import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Checkbox, useStyles2 } from '@grafana/ui';
import React, { useEffect, useRef } from 'react';

export const CheckboxWithCount = ({
  label,
  count,
  checked,
  indeterminate,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const styles = useStyles2(getStyles);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Explicitly manage indeterminate state on the actual input element
  useEffect(() => {
    if (wrapperRef.current) {
      const inputElement = wrapperRef.current.querySelector('input[type="checkbox"]');
      if (inputElement) {
        (inputElement as HTMLInputElement).indeterminate = indeterminate ?? false;
      }
    }
  }, [indeterminate, checked]); // Include checked to ensure it updates on state changes

  return (
    <div ref={wrapperRef} className={styles.checkboxWrapper} title={label}>
      <Checkbox 
        label={label} 
        checked={checked}
        indeterminate={indeterminate}
        onChange={onChange} 
      />
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
    count: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(0.5),
      display: 'inline-block',
    }),
  };
}
