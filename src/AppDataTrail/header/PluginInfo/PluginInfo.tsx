import { css } from '@emotion/css';
import { usePluginContext, type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { type PrometheusBuildInfo } from 'helpers/MetricDatasourceHelper';
import { logger } from 'tracking/logger/logger';
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
        Grafana Metrics Drilldown v{version}
      </h5>
      <div className={styles.subTitle}>Last update: {updated}</div>
    </div>
  );
}

function InfoMenu({ getPrometheusBuildInfo }: Readonly<PluginInfoProps>) {
  const styles = useStyles2(getStyles);

  const isDev = pluginCommitSha === 'dev';
  const shortCommitSha = isDev ? pluginCommitSha : pluginCommitSha.slice(0, 8);

  const [promBuildInfo, setPromBuildInfo] = useState<PrometheusBuildInfo>();
  useEffect(() => {
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
        label={`Commit SHA: ${shortCommitSha}`}
        icon="github"
        onClick={() => window.open(pluginCommitURL)}
        disabled={isDev}
      />
      <Menu.Item
        label="Changelog"
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
        label="Contribute"
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
        label="Documentation"
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
        label="Report an issue"
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
        label={`Grafana ${grafanaBuildInfo.edition} v${grafanaBuildInfo.version} (${grafanaBuildInfo.env})`}
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
          // eslint-disable-next-line sonarjs/no-nested-template-literals
          label={`${promBuildInfo.application || '?'} ${promBuildInfo.version} ${
            promBuildInfo.buildDate ? `(${promBuildInfo.buildDate})` : ''
          }`}
          icon="gf-prometheus"
          onClick={() =>
            window.open(`${promBuildInfo.repository}/commit/${promBuildInfo.revision}`, '_blank', 'noopener,noreferrer')
          }
        />
      )}
    </Menu>
  );
}

type PluginInfoProps = { getPrometheusBuildInfo: () => Promise<PrometheusBuildInfo | undefined> };

export function PluginInfo({ getPrometheusBuildInfo }: Readonly<PluginInfoProps>) {
  return (
    <Dropdown overlay={() => <InfoMenu getPrometheusBuildInfo={getPrometheusBuildInfo} />} placement="bottom-end">
      <Button
        icon="info-circle"
        variant="secondary"
        tooltip="Plugin info"
        tooltipPlacement="top"
        title="Plugin info"
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
