import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

type SectionTitleProps = {
  title: string;
  description: string;
};

export function SectionTitle({ title, description }: Readonly<SectionTitleProps>) {
  const styles = useStyles2(getStyles);

  return (
    <h6 className={styles.title}>
      <span>{title}</span>
      <Tooltip content={description} placement="top">
        <Icon name="info-circle" size="sm" className={styles.infoIcon} />
      </Tooltip>
    </h6>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    title: css({
      fontSize: '15px',
      fontWeight: theme.typography.fontWeightLight,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(0.5),
    }),
    infoIcon: css({
      marginLeft: theme.spacing(1),
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      position: 'relative',
      top: '-4px',
    }),
  };
}
