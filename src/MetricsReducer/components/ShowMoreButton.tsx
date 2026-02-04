import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import React, { type MouseEventHandler } from 'react';

type ShowMoreButtonProps = {
  label: string;
  batchSizes: {
    increment: number;
    current: number;
    total: number;
  };
  onClick: MouseEventHandler<HTMLButtonElement>;
  tooltip?: string;
};

// eslint-disable-next-line no-unused-vars
export function ShowMoreButton({ label, batchSizes, onClick, tooltip }: Readonly<ShowMoreButtonProps>) {
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
