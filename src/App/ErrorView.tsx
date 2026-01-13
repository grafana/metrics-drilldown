import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Collapse, TextLink, useStyles2 } from '@grafana/ui';
import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { InlineBanner } from './InlineBanner';

type ErrorViewProps = { error: Error };

export function ErrorView({ error }: Readonly<ErrorViewProps>) {
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

  const [isCollapseOpen, setIsCollapseOpen] = useState(false);

  return (
    <div className={styles.container}>
      <InlineBanner
        severity="error"
        title={t('error-view.title', 'Fatal error!')}
        error={error}
        errorContext={{ handheldBy: 'React error boundary' }}
        message={
          <>
            <p className={styles.message}>
              <Trans i18nKey="error-view.message">
                Please{' '}
                <TextLink href="#" onClick={onClickReload}>
                  try reloading the page
                </TextLink>{' '}
                or, if the problem persists, contact your organization admin. Sorry for the inconvenience.
              </Trans>
            </p>
            <p>
              <Collapse
                className={styles.callStack}
                label={t('error-view.stack-trace-label', 'View stack trace')}
                isOpen={isCollapseOpen}
                onToggle={() => setIsCollapseOpen(!isCollapseOpen)}
              >
                <pre>
                  <code>{error.stack}</code>
                </pre>
              </Collapse>
            </p>
          </>
        }
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      margin: theme.spacing(2),
    }),
    message: css({
      margin: theme.spacing(2, 0, 1, 0),
    }),
    callStack: css({
      backgroundColor: 'transparent',
      border: '0 none',

      '& button': css({
        paddingLeft: theme.spacing(1.5),
      }),

      '& button:focus': css({
        outline: 'none',
        boxShadow: 'none',
      }),

      '& button > svg': css({
        marginLeft: theme.spacing(-2),
        marginRight: theme.spacing(0.5),
      }),

      '& [class$="collapse__loader"]': css({
        display: 'none',
      }),
    }),
  };
}
