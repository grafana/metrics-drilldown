import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import React from 'react';

export class NoRelatedLogsScene extends SceneObjectBase<SceneObjectState> {
  static readonly Component = () => {
    const styles = useStyles2(getStyles);

    return (
      <Stack direction="column" gap={1}>
        <Text color="warning">Related logs is an experimental feature.</Text>
        <Text>
          No related logs found. To see related logs, you can either:
          <ul className={styles.list}>
            <li>adjust the label filter to find logs with the same labels as the currently-selected metric</li>
            <li>
              select a metric created by a{' '}
              <TextLink external href="https://grafana.com/docs/loki/latest/alert/#recording-rules">
                Loki Recording Rule
              </TextLink>
            </li>
          </ul>
        </Text>
      </Stack>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      paddingLeft: theme.spacing(2),
    }),
  };
}
