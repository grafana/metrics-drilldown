import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import React, { type ReactNode } from 'react';

type Props = {
  blockingMessage?: string;
  isLoading?: boolean;
  children?: ReactNode;
};

export function StatusWrapper({ blockingMessage, isLoading, children }: Readonly<Props>) {
  const styles = useStyles2(getStyles);

  if (isLoading && !blockingMessage) {
    blockingMessage = 'Loading...';
  }

  if (isLoading) {
    return <LoadingPlaceholder className={styles.statusMessage} text={blockingMessage} />;
  }

  if (!blockingMessage) {
    return <>{children}</>;
  }

  return <div className={styles.statusMessage}>{blockingMessage}</div>;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    statusMessage: css({
      fontStyle: 'italic',
      marginTop: theme.spacing(7),
      textAlign: 'center',
      width: '100%',
    }),
  };
}
