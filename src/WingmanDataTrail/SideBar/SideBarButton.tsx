import { css, cx } from '@emotion/css';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

type SideBarButtonProps = {
  ariaLabel: string;
  disabled: boolean;
  visible: boolean;
  active: boolean;
  tooltip: string;
  onClick: () => void;
  icon?: IconName;
  text?: string;
};

export function SideBarButton({
  ariaLabel,
  disabled,
  visible,
  active,
  icon,
  tooltip,
  text,
  onClick,
}: SideBarButtonProps) {
  const styles = useStyles2(getStyles);

  return (
    <Button
      className={cx(styles.button, disabled && 'disabled', visible && 'visible', active && 'active')}
      size="md"
      variant="secondary"
      fill="text"
      icon={icon}
      aria-label={ariaLabel}
      tooltip={tooltip}
      tooltipPlacement="right"
      onClick={onClick}
      disabled={disabled}
    >
      {text}
    </Button>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      margin: 0,
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.maxContrast,
        background: 'transparent',
      },
      '&.disabled:hover': {
        color: theme.colors.text.secondary,
      },
      '&.visible': {
        color: theme.colors.text.maxContrast,
      },
      '&.active': {
        color: theme.colors.text.maxContrast,
      },
    }),
  };
}
