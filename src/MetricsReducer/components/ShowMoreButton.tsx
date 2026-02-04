import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import React, { type MouseEventHandler } from 'react';

type ShowMoreButtonProps = {
  batchSizes: {
    increment: number;
    current: number;
    total: number;
  };
  onClick: MouseEventHandler<HTMLButtonElement>;
  tooltip?: string;
};

export function ShowMoreButton({ batchSizes, onClick, tooltip }: Readonly<ShowMoreButtonProps>) {
  const buttonText = t('show-more-button.text', 'Show {{increment}} more ({{current}}/{{total}})', {
    increment: batchSizes.increment,
    current: batchSizes.current,
    total: batchSizes.total,
    count: batchSizes.increment,
  });

  return (
    <Button variant="secondary" fill="outline" onClick={onClick} tooltip={tooltip} tooltipPlacement="top">
      {buttonText}
    </Button>
  );
}
