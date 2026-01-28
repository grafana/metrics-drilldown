import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import React, { memo } from 'react';

type PluginLogoProps = {
  size: 'small' | 'large';
};

export const PluginLogo = memo(function PluginLogoComponent({ size }: PluginLogoProps) {
  const styles = useStyles2(getStyles);
  return <img className={cx(styles.logo, size)} src="public/plugins/grafana-metricsdrilldown-app/img/logo.svg" alt="Metrics Drilldown Logo" />;
});

const getStyles = () => ({
  logo: css`
    &.small {
      width: 24px;
      height: 24px;
      margin-right: 4px;
      position: relative;
      top: -2px;
    }

    &.large {
      width: 40px;
      height: 40px;
    }
  `,
});
