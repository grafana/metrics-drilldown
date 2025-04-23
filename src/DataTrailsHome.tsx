import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Box, Button, Icon, Stack, Text, TextLink, useStyles2, useTheme2 } from '@grafana/ui';
import React from 'react';

import { testIds } from 'App/testIds';
import { UI_TEXT } from 'constants/ui';

import { DarkModeRocket, LightModeRocket } from './assets/rockets';
import { type DataTrail } from './DataTrail';
import { DataTrailsRecentMetrics } from './DataTrailsRecentMetrics';
import { reportExploreMetrics } from './interactions';
import { getTrailStore } from './TrailStore/TrailStore';
import { getDatasourceForNewTrail, newMetricsTrail } from './utils';

export interface DataTrailsHomeState extends SceneObjectState {
  onTrailSelected: (trail: DataTrail) => void;
}

export class DataTrailsHome extends SceneObjectBase<DataTrailsHomeState> {
  public constructor(state: DataTrailsHomeState) {
    super(state);
  }

  public onNewMetricsTrail = () => {
    const trail = newMetricsTrail(getDatasourceForNewTrail(), true);
    reportExploreMetrics('exploration_started', { cause: 'new_clicked' });
    getTrailStore().setRecentTrail(trail);
    this.state.onTrailSelected(trail);
  };

  public onSelectRecentTrail = (trail: DataTrail) => {
    reportExploreMetrics('exploration_started', { cause: 'recent_clicked' });
    getTrailStore().setRecentTrail(trail, true);
    this.state.onTrailSelected(trail);
  };

  public onSelectBookmark = (bookmarkIndex: number) => {
    reportExploreMetrics('exploration_started', { cause: 'bookmark_clicked' });
    const trail = getTrailStore().getTrailForBookmarkIndex(bookmarkIndex);
    getTrailStore().setRecentTrail(trail);
    this.state.onTrailSelected(trail);
  };

  static Component = ({ model }: SceneComponentProps<DataTrailsHome>) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    return (
      <article className={styles.container} data-testid={testIds.pageHome.container}>
        <section className={styles.homepageBox}>
          <Stack direction="column" alignItems="center">
            <div>{theme.isDark ? <DarkModeRocket /> : <LightModeRocket />}</div>
            <Text element="h1" textAlignment="center" weight="medium">
              {UI_TEXT.HOME.TITLE}
            </Text>
            <Box>
              <Text element="p" textAlignment="center" color="secondary">
                {UI_TEXT.HOME.SUBTITLE}
                <TextLink
                  href="https://grafana.com/docs/grafana/latest/explore/explore-metrics/"
                  external
                  style={{ marginLeft: '8px' }}
                >
                  Learn more
                </TextLink>
              </Text>
            </Box>
            <div className={styles.gap24}>
              <Button
                size="lg"
                variant="primary"
                onClick={model.onNewMetricsTrail}
                data-testid={testIds.pageHome.startButton}
              >
                <div className={styles.startButton}>{UI_TEXT.HOME.START_BUTTON}</div>
                <Icon name="arrow-right" size="lg" style={{ marginLeft: '8px' }} />
              </Button>
            </div>
          </Stack>
        </section>
        <DataTrailsRecentMetrics onSelect={model.onSelectRecentTrail} />
      </article>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      marginTop: '84px',
      flexDirection: 'column',
      height: '100%',
      boxSizing: 'border-box', // Ensure padding doesn't cause overflow
      marginBottom: theme.spacing(6), // Prevent last row of cards from touching page bottom
    }),
    homepageBox: css({
      backgroundColor: theme.colors.background.secondary,
      width: '904px',
      padding: '80px 32px',
      boxSizing: 'border-box', // Ensure padding doesn't cause overflow
      flexShrink: 0,
    }),
    startButton: css({
      fontWeight: theme.typography.fontWeightLight,
    }),
    gap24: css({
      marginTop: theme.spacing(2), // Adds a 24px gap since there is already a 8px gap from the button
    }),
  };
}
