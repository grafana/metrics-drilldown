import { css } from '@emotion/css';
import { usePluginContext, type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import React from 'react';

import { PluginLogo } from './PluginLogo';
import { GIT_COMMIT } from '../version';

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

function InfoMenu() {
  const isDev = pluginCommitSha === 'dev';
  const shortCommitSha = isDev ? pluginCommitSha : pluginCommitSha.slice(0, 8);

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
        onClick={() => window.open('https://github.com/grafana/metrics-drilldown/blob/main/CHANGELOG.md')}
      />
      <Menu.Item
        label="Contribute"
        icon="external-link-alt"
        onClick={() => window.open('https://github.com/grafana/metrics-drilldown/blob/main/docs/contributing.md')}
      />
      <Menu.Item
        label="Documentation"
        icon="document-info"
        onClick={() => window.open('https://grafana.com/docs/grafana/latest/explore/simplified-exploration/metrics')}
      />
      <Menu.Item
        label="Report an issue"
        icon="bug"
        onClick={() => window.open('https://github.com/grafana/metrics-drilldown/issues/new?template=bug_report.md')}
      />
      <Menu.Divider />
      <Menu.Item
        label={`Grafana ${grafanaBuildInfo.edition} v${grafanaBuildInfo.version} (${grafanaBuildInfo.env})`}
        icon="grafana"
        onClick={() => window.open(`https://github.com/grafana/grafana/commit/${grafanaBuildInfo.commit}`)}
      />
    </Menu>
  );
}

export function PluginInfo() {
  return (
    <Dropdown overlay={() => <InfoMenu />} placement="bottom-end">
      <Button icon="info-circle" variant="secondary" tooltip="Plugin info" tooltipPlacement="top" title="Plugin info" />
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
});
