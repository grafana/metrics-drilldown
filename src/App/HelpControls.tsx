import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { PluginInfo } from 'AppDataTrail/header/PluginInfo/PluginInfo';

export function HelpControls() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <PluginInfo />
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
  };
}
