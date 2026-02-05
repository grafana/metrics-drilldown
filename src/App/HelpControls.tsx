import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import React from 'react';

import { GiveFeedbackButton } from 'AppDataTrail/header/GiveFeedbackButton';
import { PluginInfo } from 'AppDataTrail/header/PluginInfo/PluginInfo';

export function HelpControls() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Stack direction="row" gap={1} alignItems="center">
        <div className={styles.feedbackWrapper}>
          <GiveFeedbackButton />
        </div>
        <PluginInfo />
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'absolute',
      top: theme.spacing(2),
      right: theme.spacing(2),
      zIndex: theme.zIndex.dropdown,
    }),
    // Override GiveFeedbackButton's internal absolute positioning
    feedbackWrapper: css({
      '& > div': {
        position: 'static',
      },
    }),
  };
}
