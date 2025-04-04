import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { InlineBanner } from './InlineBanner';

export function ErrorView({ error }: { error: Error }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <InlineBanner
        severity="error"
        title="Fatal error!"
        message="Please try reloading the page or, if the problem persists, contact your organization admin. Sorry for the inconvenience."
        error={error}
        errorContext={{ handheldBy: 'App error view' }}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      margin: theme.spacing(2),
    }),
  };
}
