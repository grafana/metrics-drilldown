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

export function ShowMoreButton({ label, batchSizes, onClick, tooltip }: Readonly<ShowMoreButtonProps>) {
  const buttonText =
    batchSizes.increment === 1
      ? t('show-more-button.text-singular', 'Show {{increment}} more {{label}} ({{current}}/{{total}})', {
          increment: batchSizes.increment,
          label,
          current: batchSizes.current,
          total: batchSizes.total,
        })
      : t('show-more-button.text-plural', 'Show {{increment}} more {{label}}s ({{current}}/{{total}})', {
          increment: batchSizes.increment,
          label,
          current: batchSizes.current,
          total: batchSizes.total,
        });

  return (
    <Button variant="secondary" fill="outline" onClick={onClick} tooltip={tooltip} tooltipPlacement="top">
      {buttonText}
    </Button>
  );
}
