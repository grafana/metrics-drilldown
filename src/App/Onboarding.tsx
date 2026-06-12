import { css } from '@emotion/css';
import { locationUtil, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getResponsiveBreakpoints } from 'shared/utils/utils.styles';

import { HelpControls } from './HelpControls';

export function Onboarding() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrap}>
      <HelpControls />
      <div className={styles.graphicContainer}>
        <img src="/public/plugins/grafana-metricsdrilldown-app/img/logo.svg" alt="" />
      </div>
      <div className={styles.text}>
        <h3 className={styles.title}>
          <Trans i18nKey="onboarding.title">Welcome to Grafana Metrics Drilldown</Trans>
        </h3>

        <p>
          <Trans i18nKey="onboarding.no-datasource">
            We noticed there is no Prometheus-compatible metrics data source configured.
            <br />
            Add a{' '}
            <a className="external-link" href={locationUtil.assureBaseUrl('/connections/datasources/new')}>
              Prometheus or compatible metrics data source
            </a>{' '}
            to view metrics.
          </Trans>
        </p>

        <br />

        <p>
          <Trans i18nKey="onboarding.learn-more">
            Check{' '}
            <a
              href="https://grafana.com/docs/grafana/latest/explore/simplified-exploration/metrics/"
              target="_blank"
              className="external-link"
              rel="noreferrer"
            >
              our docs
            </a>{' '}
            to learn more or
            <br />
            <a
              href="https://play.grafana.org/a/grafana-metricsdrilldown-app/drilldown"
              target="_blank"
              className="external-link"
              rel="noreferrer"
            >
              try it online
            </a>{' '}
            in Grafana Play!
          </Trans>
        </p>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    graphicContainer: css({
      [getResponsiveBreakpoints(theme).up('md')]: {
        alignSelf: 'flex-end',
        height: 'auto',
        padding: theme.spacing(1),
        width: '300px',
      },
      [getResponsiveBreakpoints(theme).up('lg')]: {
        alignSelf: 'flex-end',
        height: 'auto',
        padding: theme.spacing(1),
        width: '400px',
      },
      display: 'flex',
      height: '250px',
      justifyContent: 'center',
      margin: '0 auto',
      padding: theme.spacing(1),
      width: '200px',
    }),

    text: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }),
    title: css({
      marginBottom: '1.5rem',
    }),
    wrap: css({
      position: 'relative',
      [getResponsiveBreakpoints(theme).up('md')]: {
        flexDirection: 'row',
        margin: '4rem auto auto auto',
      },
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto auto auto',
      padding: '2rem',
      textAlign: 'center',
    }),
  };
};
