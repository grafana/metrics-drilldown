import { css } from '@emotion/css';
import { dateTimeFormat, type GrafanaTheme2 } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { Card, IconButton, useStyles2 } from '@grafana/ui';
import React, { useMemo } from 'react';

import { type DataTrail } from './DataTrail';
import { VAR_FILTERS } from './shared';
import { getTrailStore, type DataTrailBookmark } from './TrailStore/TrailStore';
import { getMetricName } from './utils';
import { isAdHocFiltersVariable } from './utils/utils.variables';

export type Props = {
  trail?: DataTrail;
  bookmark?: DataTrailBookmark;
  onSelect: () => void;
  onDelete?: () => void;
  wide?: boolean;
  compactHeight?: boolean;
};

// Helper function to truncate the value for a single key:value pair
const truncateValue = (key: string, value: string, maxLength: number) => {
  const combinedLength = key.length + 2 + value.length; // 2 for ": "
  if (combinedLength > maxLength) {
    return value.substring(0, maxLength - key.length - 5) + '...'; // 5 for ": " and "..."
  }
  return value;
};

export function DataTrailCard(props: Props) {
  const { onSelect, onDelete, bookmark } = props;
  const styles = useStyles2(getStyles);

  const values = useMemo(() => {
    let trail = props.trail || (bookmark && getTrailStore().getTrailForBookmark(bookmark));

    if (!trail) {
      return null;
    }

    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail)!;
    if (!isAdHocFiltersVariable(filtersVariable)) {
      return null;
    }

    const createdAt = bookmark?.createdAt || trail.state.createdAt;

    return {
      filters: filtersVariable.state.filters,
      metric: trail.state.metric,
      createdAt,
    };
  }, [props.trail, bookmark]);

  if (!values) {
    return null;
  }

  const { filters, metric, createdAt } = values;

  const heading = truncateValue('', getMetricName(metric), 39);
  const cardHeightClassName = `${props.compactHeight && filters.length > 0 ? styles.cardTall : ''}`;
  const cardClassName = `${styles.card} ${props.wide ? styles.cardWide : ''} ${cardHeightClassName}`;
  return (
    <article data-testid={`data-trail-card ${heading}`}>
      <Card onClick={onSelect} className={cardClassName}>
        <Card.Heading>
          <div className={styles.metricValue}>{heading}</div>
        </Card.Heading>
        <Card.Meta className={styles.meta}>
          {filters.map((f) => (
            <span key={f.key}>
              <div className={styles.secondaryFont}>{f.key}: </div>
              <div className={styles.primaryFont}>{truncateValue(f.key, f.value, 44)}</div>
            </span>
          ))}
        </Card.Meta>
        <div className={styles.deleteButton}>
          {onDelete && (
            <Card.SecondaryActions>
              <IconButton
                key="delete"
                name="trash-alt"
                className={styles.secondary}
                tooltip="Remove bookmark"
                onClick={onDelete}
                data-testid="deleteButton"
              />
            </Card.SecondaryActions>
          )}
        </div>
      </Card>
      <div className={styles.date}>
        <div className={styles.secondaryFont}>Date created: </div>
        <div className={styles.primaryFont}>{createdAt && dateTimeFormat(createdAt, { format: 'YYYY-MM-DD' })}</div>
      </div>
    </article>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    metricValue: css({
      display: 'inline',
      color: theme.colors.text.primary,
      fontWeight: 500,
      wordBreak: 'break-all',
    }),
    card: css({
      position: 'relative',
      width: '318px',
      padding: `12px ${theme.spacing(2)} ${theme.spacing(1)} ${theme.spacing(2)}`,
      alignItems: 'start',
      marginBottom: 0,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      borderBottom: 'none', // Remove the bottom border
      borderRadius: '2px 2px 0 0', // Top-left and top-right corners are 2px, bottom-left and bottom-right are 0; cannot use theme.shape.radius.default because need bottom corners to be 0
    }),
    cardWide: css({
      width: '100%',
    }),
    cardTall: css({
      height: '110px',
    }),
    secondary: css({
      color: theme.colors.text.secondary,
      fontSize: '12px',
    }),
    date: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: '0 0 2px 2px',
      padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
      backgroundColor: theme.colors.background.primary,
    }),
    meta: css({
      flexWrap: 'wrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxHeight: '36px', // 2 lines * 18px line-height
      margin: 0,
      gridArea: 'Meta',
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
    }),
    primaryFont: css({
      display: 'inline',
      color: theme.colors.text.primary,
      fontSize: '12px',
      fontWeight: '500',
      letterSpacing: '0.018px',
    }),
    secondaryFont: css({
      display: 'inline',
      color: theme.colors.text.secondary,
      fontSize: '12px',
      fontWeight: '400',
      lineHeight: '18px' /* 150% */,
      letterSpacing: '0.018px',
    }),
    deleteButton: css({
      position: 'absolute',
      bottom: theme.spacing(1),
      right: theme.spacing(1),
    }),
  };
}
