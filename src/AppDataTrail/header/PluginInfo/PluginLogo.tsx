import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { PrometheusBuildInfo } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import React, { memo } from 'react';
import InlineSVG from 'react-inlinesvg';

type PluginLogoProps = {
  size: 'small' | 'large';
};

export const PluginLogo = memo(function PluginLogoComponent({ size }: PluginLogoProps) {
  const styles = useStyles2(getStyles);
  return (
    <img
      className={cx(styles.logo, size)}
      src="public/plugins/grafana-metricsdrilldown-app/img/logo.svg"
      alt="Metrics Drilldown Logo"
    />
  );
});


const MENU_ITEM_PADDING_LEFT = 12;
const ICON_SIZE = 16;

const iconStyle = {
  position: 'absolute',
  left: MENU_ITEM_PADDING_LEFT,
  top: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  opacity: 0.7,
} as const;

export const PluginPromBuildIcon = ({ application }: PrometheusBuildInfo) => {
  if (application && application.trim().toLowerCase().includes('elasticsearch')) {
    return (
      /**
       * Elasticsearch icon (src/img/elasticsearch.svg) taken from the simple-icons package
       * licensed under the Creative Commons Zero v1.0 Universal;
       *
       * source: https://github.com/simple-icons/simple-icons
       */
      <span style={iconStyle}>
        <InlineSVG
          src="public/plugins/grafana-metricsdrilldown-app/img/elasticsearch.svg"
          width={ICON_SIZE}
          height={ICON_SIZE}
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span style={iconStyle}>
      <InlineSVG
        src="public/plugins/grafana-metricsdrilldown-app/img/prometheus.svg"
        width={ICON_SIZE}
        height={ICON_SIZE}
        aria-hidden
      />
    </span>
  );
};


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
