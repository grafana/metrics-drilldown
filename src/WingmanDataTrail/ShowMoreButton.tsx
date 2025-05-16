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
  return (
    <Button variant="secondary" fill="outline" onClick={onClick} tooltip={tooltip} tooltipPlacement="top">
      Show {batchSizes.increment} more {batchSizes.increment === 1 ? label : `${label}s`} ({batchSizes.current}/
      {batchSizes.total})
    </Button>
  );
}
