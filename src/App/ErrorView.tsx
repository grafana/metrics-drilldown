import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { TextLink, useStyles2 } from '@grafana/ui';
import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { InlineBanner } from './InlineBanner';

export function ErrorView({ error }: { error: Error }) {
  const styles = useStyles2(getStyles);

  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const onClickReload = useCallback(() => {
    const searchParams = new URLSearchParams(search);
    const newSearchParams = new URLSearchParams();

    // these are safe keys to keep
    ['from', 'to', 'timezone']
      .filter((key) => searchParams.has(key))
      .forEach((key) => newSearchParams.set(key, searchParams.get(key)!));

    navigate({ pathname, search: newSearchParams.toString() });
    window.location.reload();
  }, [navigate, pathname, search]);

  return (
    <div className={styles.container}>
      <InlineBanner
        severity="error"
        title="Fatal error!"
        message={
          <>
            Please{' '}
            <TextLink href="#" onClick={onClickReload}>
              try reloading the page
            </TextLink>{' '}
            or, if the problem persists, contact your organization admin. Sorry for the inconvenience.
          </>
        }
        error={error}
        errorContext={{ handheldBy: 'React error boundary' }}
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
