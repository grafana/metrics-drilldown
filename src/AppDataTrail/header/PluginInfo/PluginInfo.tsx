import { css } from '@emotion/css';
import { usePluginContext, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Dropdown, Icon, Menu, useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { type PrometheusBuildInfo } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { logger } from 'shared/logger/logger';
import { GIT_COMMIT } from 'version';

import { PluginLogo } from './PluginLogo';

const pluginCommitSha: string = GIT_COMMIT;
const pluginCommitURL = `https://github.com/grafana/metrics-drilldown/commit/${pluginCommitSha}`;

const { buildInfo: grafanaBuildInfo } = config;

type BuildInfoIconType = 'elasticsearch' | 'prometheus';

export function getBuildInfoIcon(buildInfo: PrometheusBuildInfo): BuildInfoIconType {
  const identifiers = [
    buildInfo.application,
    buildInfo.dataSourcePluginId,
    buildInfo.dataSourceType,
    buildInfo.repository,
  ]
    .filter((identifier): identifier is string => Boolean(identifier))
    .map((identifier) => identifier.toLowerCase());

  if (identifiers.some((identifier) => identifier.includes('elasticsearch'))) {
    return 'elasticsearch';
  }

  return 'prometheus';
}

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
      <div className={styles.subTitle}>
        {t('plugin-info.header.last-update', 'Last update: {{updated}}', { updated })}
      </div>
    </div>
  );
}

function InfoMenu({ getPrometheusBuildInfo }: Readonly<PluginInfoProps>) {
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
        label={t('plugin-info.menu.grafana-version', 'Grafana {{edition}} ({{env}})', {
          edition: grafanaBuildInfo.edition,
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
      {promBuildInfo && <BuildInfoMenuItem buildInfo={promBuildInfo} />}
    </Menu>
  );
}

function BuildInfoMenuItem({ buildInfo }: Readonly<{ buildInfo: PrometheusBuildInfo }>) {
  const styles = useStyles2(getStyles);
  const buildInfoIconType = getBuildInfoIcon(buildInfo);
  const label = t('plugin-info.menu.prom-build-info', '{{application}} {{version}} {{buildDate}}', {
    application: buildInfo.application || '?',
    version: buildInfo.version,
    buildDate: buildInfo.buildDate ? `(${buildInfo.buildDate})` : '',
  });

  return (
    <button
      className={styles.buildInfoItem}
      onClick={() =>
        window.open(`${buildInfo.repository}/commit/${buildInfo.revision}`, '_blank', 'noopener,noreferrer')
      }
      role="menuitem"
      data-role="menuitem"
      type="button"
    >
      {buildInfoIconType === 'elasticsearch' ? (
        <ElasticsearchIcon className={styles.elasticsearchBuildInfoIcon} />
      ) : (
        <Icon name="gf-prometheus" className={styles.promBuildInfoIcon} aria-hidden />
      )}
      <span className={styles.buildInfoLabel}>{label}</span>
    </button>
  );
}

function ElasticsearchIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      data-testid="elasticsearch-build-info-icon"
      viewBox="0 0 30 30"
      fill="none"
    >
      <path
        fill="currentColor"
        d="M17.4 2.2C22.9 3.3 27 8.2 27 14c0 .7-.1 1.4-.2 2.1H16.1a3.8 3.8 0 0 1 0-7.6h6.3a11 11 0 0 0-5-6.3Z"
      />
      <path
        fill="currentColor"
        d="M12.6 27.8C7.1 26.7 3 21.8 3 16c0-.7.1-1.4.2-2.1h10.7a3.8 3.8 0 0 1 0 7.6H7.6a11 11 0 0 0 5 6.3Z"
      />
      <circle cx="15" cy="15" r="3.1" fill="currentColor" />
    </svg>
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
  buildInfoItem: css`
    align-items: center;
    background: none;
    border: none;
    border-radius: ${theme.shape.radius.default};
    color: ${theme.colors.text.primary};
    cursor: pointer;
    display: flex;
    font: inherit;
    gap: ${theme.spacing(1)};
    margin: 0;
    min-height: ${theme.spacing(4)};
    padding: ${theme.spacing(0.5, 1.5)};
    text-align: left;
    white-space: nowrap;
    width: 100%;

    &:hover,
    &:focus-visible {
      background: ${theme.colors.action.hover};
      text-decoration: none;
    }
  `,
  buildInfoLabel: css`
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  promBuildInfoIcon: css`
    color: #e5502a;
  `,
  elasticsearchBuildInfoIcon: css`
    color: #00a9e5;
    flex-shrink: 0;
    height: 16px;
    opacity: 0.7;
    width: 16px;
  `,
});
