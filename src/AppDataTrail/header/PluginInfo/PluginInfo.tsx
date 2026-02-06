import { css } from '@emotion/css';
import { usePluginContext, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { type PrometheusBuildInfo } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { logger } from 'shared/logger/logger';
import { GIT_COMMIT } from 'version';

import { PluginLogo } from './PluginLogo';

const pluginCommitSha: string = GIT_COMMIT;
const pluginCommitURL = `https://github.com/grafana/metrics-drilldown/commit/${pluginCommitSha}`;

const { buildInfo: grafanaBuildInfo } = config;

function InfoMenuHeader() {
  const styles = useStyles2(getStyles);

  const {
    meta: {
      info: { version, updated },
    },
  } = usePluginContext() || { meta: { info: { version: '?.?.?', updated: '?' } } };

  return (
    <div className={styles.menuHeader}>
      <h5>
        <PluginLogo size="small" />
        {t('plugin-info.header.title', 'Grafana Metrics Drilldown v{{version}}', { version })}
      </h5>
      <div className={styles.subTitle}>{t('plugin-info.header.last-update', 'Last update: {{updated}}', { updated })}</div>
    </div>
  );
}

function InfoMenu({ getPrometheusBuildInfo }: Readonly<PluginInfoProps>) {
  const styles = useStyles2(getStyles);

  const isDev = pluginCommitSha === 'dev';
  const shortCommitSha = isDev ? pluginCommitSha : pluginCommitSha.slice(0, 8);

  const [promBuildInfo, setPromBuildInfo] = useState<PrometheusBuildInfo>();
  useEffect(() => {
    if (!getPrometheusBuildInfo) {
      return;
    }
    getPrometheusBuildInfo()
      .then((info) => setPromBuildInfo(info))
      .catch((e) => {
        logger.warn('Error while fetching Prometheus build info!');
        logger.warn(e);
        setPromBuildInfo(undefined);
      });
  }, [getPrometheusBuildInfo]);

  return (
    <Menu header={<InfoMenuHeader />}>
      <Menu.Item
        label={t('plugin-info.menu.commit-sha', 'Commit SHA: {{sha}}', { sha: shortCommitSha })}
        icon="github"
        onClick={() => window.open(pluginCommitURL)}
        disabled={isDev}
      />
      <Menu.Item
        label={t('plugin-info.menu.changelog', 'Changelog')}
        icon="list-ul"
        onClick={() =>
          window.open(
            'https://github.com/grafana/metrics-drilldown/blob/main/CHANGELOG.md',
            '_blank',
            'noopener,noreferrer'
          )
        }
      />
      <Menu.Item
        label={t('plugin-info.menu.contribute', 'Contribute')}
        icon="external-link-alt"
        onClick={() =>
          window.open(
            'https://github.com/grafana/metrics-drilldown/blob/main/docs/contributing.md',
            '_blank',
            'noopener,noreferrer'
          )
        }
      />
      <Menu.Item
        label={t('plugin-info.menu.documentation', 'Documentation')}
        icon="document-info"
        onClick={() =>
          window.open(
            'https://grafana.com/docs/grafana/latest/explore/simplified-exploration/metrics',
            '_blank',
            'noopener,noreferrer'
          )
        }
      />
      <Menu.Item
        label={t('plugin-info.menu.report-issue', 'Report an issue')}
        icon="bug"
        onClick={() =>
          window.open(
            'https://github.com/grafana/metrics-drilldown/issues/new?template=bug_report.md',
            '_blank',
            'noopener,noreferrer'
          )
        }
      />
      <Menu.Divider />
      <Menu.Item
        label={t('plugin-info.menu.grafana-version', 'Grafana {{edition}} v{{version}} ({{env}})', {
          edition: grafanaBuildInfo.edition,
          version: grafanaBuildInfo.version,
          env: grafanaBuildInfo.env,
        })}
        icon="grafana"
        onClick={() =>
          window.open(
            `https://github.com/grafana/grafana/commit/${grafanaBuildInfo.commit}`,
            '_blank',
            'noopener,noreferrer'
          )
        }
      />
      {promBuildInfo && (
        <Menu.Item
          className={styles.promBuildInfo}
          label={t('plugin-info.menu.prom-build-info', '{{application}} {{version}} {{buildDate}}', {
            application: promBuildInfo.application || '?',
            version: promBuildInfo.version,
            buildDate: promBuildInfo.buildDate ? `(${promBuildInfo.buildDate})` : '',
          })}
          icon="gf-prometheus"
          onClick={() =>
            window.open(`${promBuildInfo.repository}/commit/${promBuildInfo.revision}`, '_blank', 'noopener,noreferrer')
          }
        />
      )}
    </Menu>
  );
}

type PluginInfoProps = { getPrometheusBuildInfo?: () => Promise<PrometheusBuildInfo | undefined> };

export function PluginInfo({ getPrometheusBuildInfo }: Readonly<PluginInfoProps>) {
  return (
    <Dropdown overlay={() => <InfoMenu getPrometheusBuildInfo={getPrometheusBuildInfo} />} placement="bottom-end">
      <Button
        icon="info-circle"
        variant="secondary"
        tooltip={t('plugin-info.button.tooltip', 'Plugin info')}
        tooltipPlacement="top"
        title={t('plugin-info.button.title', 'Plugin info')}
        data-testid="plugin-info-button"
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css`
    position: relative;
    display: flex;
    align-items: center;
    width: 32px;
    height: 32px;
    line-height: 30px;
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 2px;
    border-left: 0;
    color: ${theme.colors.text.primary};
    background: ${theme.colors.background.secondary};

    &:hover {
      border-color: ${theme.colors.border.medium};
      background-color: ${theme.colors.background.canvas};
    }
  `,
  menuHeader: css`
    padding: ${theme.spacing(0.5, 1)};
    white-space: nowrap;
  `,
  subTitle: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  promBuildInfo: css`
    & svg {
      color: #e5502a;
    }
  `,
});
