import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Dropdown, Icon, Switch, TextLink, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type PrometheusBuildInfo } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { type KgAnnotationToggle } from 'shared/knowledgeGraph/KgAnnotationToggle';

import { PluginInfo } from './PluginInfo/PluginInfo';

type PluginHeaderToolbarProps = {
  kgAnnotationToggle?: KgAnnotationToggle;
  getPrometheusBuildInfo?: () => Promise<PrometheusBuildInfo | undefined>;
};

export function PluginHeaderToolbar({ kgAnnotationToggle, getPrometheusBuildInfo }: Readonly<PluginHeaderToolbarProps>) {
  const styles = useStyles2(getToolbarStyles);

  return (
    <div className={styles.toolbar}>
      <QueryOptionsButton kgAnnotationToggle={kgAnnotationToggle} />
      <PluginInfo getPrometheusBuildInfo={getPrometheusBuildInfo} />
    </div>
  );
}

function QueryOptionsButton({ kgAnnotationToggle }: Readonly<{ kgAnnotationToggle?: KgAnnotationToggle }>) {
  if (!kgAnnotationToggle) {
    return (
      <QueryOptionsMenu
        isEnabled={false}
        insightsAvailable={false}
        hasLayers={false}
        onToggleEnabled={undefined}
      />
    );
  }

  return <QueryOptionsMenuWithKgState kgAnnotationToggle={kgAnnotationToggle} />;
}

function QueryOptionsMenuWithKgState({ kgAnnotationToggle }: Readonly<{ kgAnnotationToggle: KgAnnotationToggle }>) {
  const { isEnabled } = kgAnnotationToggle.useState();
  const { layers } = kgAnnotationToggle.state.layerSetRef.resolve().useState();

  return (
    <QueryOptionsMenu
      isEnabled={isEnabled}
      insightsAvailable={true}
      hasLayers={layers.length > 0}
      onToggleEnabled={kgAnnotationToggle.toggleEnabled}
    />
  );
}

type QueryOptionsMenuProps = {
  isEnabled: boolean;
  insightsAvailable: boolean;
  hasLayers: boolean;
  onToggleEnabled?: () => void;
};

function getInsightsTooltip(insightsAvailable: boolean, hasLayers: boolean, description: string) {
  if (!insightsAvailable || hasLayers) {
    return <span>{description}</span>;
  }

  return (
    <span>
      {description} {t('kg-annotations.toggle.disabled-tooltip', 'Add label filters to match entities.')}{' '}
      <TextLink external href="https://grafana.com/docs/grafana-cloud/knowledge-graph/introduction/">
        {t('kg-annotations.toggle.learn-more', 'Learn more')}
      </TextLink>
    </span>
  );
}

function QueryOptionsMenu({ isEnabled, insightsAvailable, hasLayers, onToggleEnabled }: Readonly<QueryOptionsMenuProps>) {
  const styles = useStyles2(getQueryOptionsStyles);

  const description = t(
    'kg-annotations.toggle.description',
    'Overlay health states (critical, warning, info) from the Knowledge Graph on timeseries panels.'
  );
  const insightsTooltip = getInsightsTooltip(insightsAvailable, hasLayers, description);

  const renderPopover = () => (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className={styles.queryOptionsPopover}
      role="dialog"
      aria-modal="true"
      aria-label={t('query-options.aria-label', 'Query options')}
      onClick={(evt) => evt.stopPropagation()}
    >
      <div className={styles.queryOptionsHeading}>
        <Trans i18nKey="query-options.title">Query options</Trans>
      </div>
      <div className={styles.queryOptionsGrid}>
        <div>
          <Trans i18nKey="kg-annotations.toggle.label">Insights</Trans>{' '}
          <Tooltip content={insightsTooltip}>
            <Icon name="info-circle" />
          </Tooltip>
        </div>
        <span>
          <Switch
            label={t('query-options.toggle-insights', 'Toggle insights annotations')}
            value={isEnabled}
            disabled={!insightsAvailable || !hasLayers}
            onChange={onToggleEnabled}
          />
        </span>
      </div>
    </div>
  );

  return (
    <Dropdown overlay={renderPopover} placement="bottom">
      <ToolbarButton
        icon="cog"
        variant="canvas"
        aria-label={t('query-options.aria-label', 'Query options')}
        data-testid="query-options-button"
      />
    </Dropdown>
  );
}

function getToolbarStyles(theme: GrafanaTheme2) {
  return {
    toolbar: css({
      display: 'flex',
      alignItems: 'stretch',
      height: theme.spacing(theme.components.height.md),
      boxSizing: 'border-box',
      border: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',

      button: {
        border: 'none',
        borderRadius: 0,
        height: 'auto',

        '&:hover, &:focus': {
          border: 'none',
        },
      },
    }),
  };
}

function getQueryOptionsStyles(theme: GrafanaTheme2) {
  return {
    queryOptionsHeading: css({
      fontWeight: theme.typography.fontWeightMedium,
      paddingBottom: theme.spacing(2),
    }),
    queryOptionsGrid: css({
      alignItems: 'center',
      columnGap: theme.spacing(2),
      display: 'grid',
      gridTemplateColumns: '1fr 50px',
      rowGap: theme.spacing(1),
    }),
    queryOptionsPopover: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      display: 'flex',
      flexDirection: 'column',
      marginRight: theme.spacing(2),
      padding: theme.spacing(2),
    }),
  };
}
