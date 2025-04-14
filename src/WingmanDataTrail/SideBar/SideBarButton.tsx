import { css, cx } from '@emotion/css';
import { availableIconsIndex, type GrafanaTheme2, type IconName } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { GroupsIcon } from './custom-icons/GroupsIcon';
import { RulesIcon } from './custom-icons/RulesIcon';

type SideBarButtonProps = {
  ariaLabel: string;
  disabled: boolean;
  visible: boolean;
  active: boolean;
  tooltip: string;
  onClick: () => void;
  iconOrText: string | IconName;
};

export function SideBarButton({
  ariaLabel,
  disabled,
  visible,
  active,
  tooltip,
  iconOrText,
  onClick,
}: SideBarButtonProps) {
  const styles = useStyles2(getStyles);

  let buttonIcon;
  let ButtonChild;

  if (iconOrText in availableIconsIndex) {
    buttonIcon = iconOrText as IconName;
  } else {
    // some icons are not available in the Saga Design System and have been added as SVG files to the code base
    if (iconOrText === 'rules') {
      ButtonChild = RulesIcon;
    } else if (iconOrText === 'groups') {
      ButtonChild = GroupsIcon;
    } else {
      ButtonChild = function ButtonChildText() {
        return <>{iconOrText}</>;
      };
    }
  }

  return (
    <Button
      className={cx(styles.button, disabled && 'disabled', visible && 'visible', active && 'active')}
      size="md"
      variant="secondary"
      fill="text"
      icon={buttonIcon}
      aria-label={ariaLabel}
      tooltip={tooltip}
      tooltipPlacement="right"
      onClick={onClick}
      disabled={disabled}
    >
      {ButtonChild && <ButtonChild />}
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
