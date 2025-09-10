import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Button, RadioButtonList, useStyles2 } from '@grafana/ui';
import React from 'react';

import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';

type LabelsListProps = {
  labels: Array<SelectableValue<string>>;
  selectedLabel: string;
  onSelectLabel: (label: string) => void;
  onClearSelection: () => void;
};

export function LabelsList({ labels, selectedLabel, onSelectLabel, onClearSelection }: Readonly<LabelsListProps>) {
  const styles = useStyles2(getStyles);

  return (
    <>
      <div className={styles.listHeader}>
        <div className={styles.selected}>
          {selectedLabel === NULL_GROUP_BY_VALUE ? 'No selection' : `Selected: "${selectedLabel}"`}
        </div>
        <Button
          variant="secondary"
          fill="text"
          onClick={onClearSelection}
          disabled={selectedLabel === NULL_GROUP_BY_VALUE}
        >
          clear
        </Button>
      </div>

      {!labels.length && <div className={styles.noResults}>No results.</div>}

      {labels.length > 0 && (
        <div className={styles.list} data-testid="labels-list">
          {/* TODO: use a custom one to have option labels with ellipsis and title/tooltip when hovering
      now we're customizing too much the component CSS */}
          <RadioButtonList name="labels-list" options={labels} onChange={onSelectLabel} value={selectedLabel} />
        </div>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    listHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      margin: theme.spacing(0),
      padding: theme.spacing(0, 0, 0, 1),
    }),
    selected: css({
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }),
    list: css({
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      gap: 0,
      overflowY: 'auto',

      '& [role="radiogroup"]': {
        gap: 0,
      },

      '& label': {
        cursor: 'pointer',
        padding: theme.spacing(0.5, 1),
        '&:hover': {
          background: theme.colors.background.secondary,
        },
      },

      '& label div': {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
    noResults: css({
      fontStyle: 'italic',
      padding: theme.spacing(0, 1, 1, 1),
    }),
  };
}
