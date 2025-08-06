import { css, cx } from '@emotion/css';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Button, Dropdown, Icon, Menu, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type MetricUsageType } from 'WingmanDataTrail/ListControls/MetricsSorter/MetricUsageFetcher';

import { type WithUsageDataPreviewPanelState } from './WithUsageDataPreviewPanel';

// TODO: pass full MetricUsageDetailsObject into UsageSectionProps?
export interface UsageSectionProps {
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
      {usageType === 'dashboard-usage' ? (
        <>
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
                        content={`Used ${item.count} ${item.count === 1 ? 'time' : 'times'} in ${item.label}`}
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
              tooltip={`Metric used in ${usageCount} ${
                usageCount === 1 ? 'dashboard' : 'dashboards'
              }. Click to view them.`}
              className={cx(styles.usageItem, styles.clickableUsageItem)}
            >
              <span data-testid={usageType}>
                <Icon name={icon} style={{ marginRight: '4px' }} /> {usageCount}
              </span>
            </Button>
          </Dropdown>
        </>
      ) : (
        <Tooltip
          content={`Metric is used in ${usageCount} ${usageCount === 1 ? singularUsageType : pluralUsageType}`}
          placement="top"
        >
          <span className={styles.usageItem} data-testid={usageType}>
            <Icon name={icon} /> {usageCount}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    usageContainer: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: '17px',
      padding: '8px 12px',
      border: `1px solid ${theme.colors.border.weak}`,
      borderTopWidth: 0,
      backgroundColor: theme.colors.background.primary,
      alignItems: 'center',
    }),
    usageItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
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
