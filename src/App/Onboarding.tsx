import { css } from '@emotion/css';
import { locationUtil, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import React from 'react';
import SVG from 'react-inlinesvg';

export function Onboarding() {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  return (
    <div className={styles.wrap}>
      <div className={styles.graphicContainer}>
        <SVG
          src={
            // eslint-disable-next-line sonarjs/no-all-duplicated-branches
            theme.isDark
              ? `/public/plugins/grafana-metricsdrilldown-app/img/logo.svg`
              : `/public/plugins/grafana-metricsdrilldown-app/img/logo.svg`
          }
        />
      </div>
      <div className={styles.text}>
        <h3 className={styles.title}>Welcome to Grafana Metrics Drilldown</h3>

        <p>
          We noticed there is no Prometheus datasource configured.
          <br />
          Add a{' '}
          <a className="external-link" href={locationUtil.assureBaseUrl('/connections/datasources/new')}>
            Prometheus datasource
          </a>{' '}
          to view metrics.
        </p>

        <br />

        <p>
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
        </p>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    graphicContainer: css({
      [theme.breakpoints.up('md')]: {
        alignSelf: 'flex-end',
        height: 'auto',
        padding: theme.spacing(1),
        width: '300px',
      },
      [theme.breakpoints.up('lg')]: {
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
      [theme.breakpoints.up('md')]: {
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
