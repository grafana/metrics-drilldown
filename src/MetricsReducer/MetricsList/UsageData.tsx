import { css, cx } from '@emotion/css';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Icon, Menu, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type MetricUsageType } from 'MetricsReducer/list-controls/MetricsSorter/MetricUsageFetcher';

import { type WithUsageDataPreviewPanelState } from './WithUsageDataPreviewPanel';

interface UsageSectionProps {
  usageType: MetricUsageType;
  usageCount: number;
  singularUsageType: string;
  pluralUsageType: string;
  icon: IconName;
  dashboardItems: WithUsageDataPreviewPanelState['dashboardItems'];
}

export function UsageData({
  usageType,
  usageCount,
  singularUsageType,
  pluralUsageType,
  icon,
  dashboardItems,
}: Readonly<UsageSectionProps>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.usageContainer} data-testid="usage-data-panel">
      <Stack direction="row" justifyContent="flex-start" alignItems="center" gap={2}>
        {usageType === 'dashboard-usage' ? (
          <Dropdown
            placement="right-start"
            overlay={
              <Menu style={{ maxWidth: '240px', maxHeight: '245px', overflowY: 'auto' }}>
                {dashboardItems.map((item) => (
                  <Menu.Item
                    key={item.id}
                    label=""
                    url={item.url}
                    target="_blank"
                    className={styles.menuItem}
                    component={() => (
                      <Tooltip
                        content={
                          item.count === 1
                            ? t('usage-data.used-time-singular', 'Used {{count}} time in {{label}}', {
                                count: item.count,
                                label: item.label,
                              })
                            : t('usage-data.used-time-plural', 'Used {{count}} times in {{label}}', {
                                count: item.count,
                                label: item.label,
                              })
                        }
                        placement="right"
                      >
                        <div className={styles.menuItemContent}>
                          <Icon name="external-link-alt" /> {item.label} ({item.count})
                        </div>
                      </Tooltip>
                    )}
                  />
                ))}
              </Menu>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              tooltip={
                usageCount === 1
                  ? t(
                      'usage-data.metric-used-singular',
                      'Metric used {{count}} time in dashboard queries. Click to view the dashboards.',
                      { count: usageCount }
                    )
                  : t(
                      'usage-data.metric-used-plural',
                      'Metric used {{count}} times in dashboard queries. Click to view the dashboards.',
                      { count: usageCount }
                    )
              }
              className={cx(styles.usageItem, styles.clickableUsageItem)}
            >
              <Stack direction="row" alignItems="center" gap={0.5} data-testid={usageType}>
                <Icon name={icon} />
                <span>{usageCount}</span>
              </Stack>
            </Button>
          </Dropdown>
        ) : (
          <Tooltip
            content={
              usageCount === 1
                ? t('usage-data.metric-used-in-singular', 'Metric is used in {{count}} {{usageType}}', {
                    count: usageCount,
                    usageType: singularUsageType,
                  })
                : t('usage-data.metric-used-in-plural', 'Metric is used in {{count}} {{usageType}}', {
                    count: usageCount,
                    usageType: pluralUsageType,
                  })
            }
            placement="top"
          >
            <span className={styles.usageItem} data-testid={usageType}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Icon name={icon} />
                <span>{usageCount}</span>
              </Stack>
            </span>
          </Tooltip>
        )}
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    usageContainer: css({
      padding: '8px 12px',
      border: `1px solid ${theme.colors.border.weak}`,
      borderTopWidth: 0,
      backgroundColor: theme.colors.background.primary,
    }),
    usageItem: css({
      color: theme.colors.text.secondary,
      opacity: '65%',
    }),
    clickableUsageItem: css({
      backgroundColor: 'transparent',
      border: 'none',
    }),
    menuItem: css({
      color: theme.colors.text.primary,
      textDecoration: 'none',
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
    menuItemContent: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: theme.colors.text.primary,
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
  };
}
