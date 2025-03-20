import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Icon, IconButton, Input, RadioButtonList, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';

interface LabelsBrowserState extends SceneObjectState {
  labelVariableName: string;
}

export class LabelsBrowser extends SceneObjectBase<LabelsBrowserState> {
  constructor({ labelVariableName }: { labelVariableName: LabelsBrowserState['labelVariableName'] }) {
    super({
      key: 'labels-browser',
      labelVariableName,
    });
  }

  onClickLabel = (value: string) => {
    const labelsVariable = sceneGraph.lookupVariable(this.state.labelVariableName, this) as LabelsVariable;
    labelsVariable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<LabelsBrowser>) => {
    const styles = useStyles2(getStyles);
    const { labelVariableName } = model.useState();

    const labelsVariable = sceneGraph.lookupVariable(labelVariableName, model) as LabelsVariable;
    const { loading, options: labels, value } = labelsVariable.useState();

    const [searchValue, setSearchValue] = useState('');

    const filteredList: Array<SelectableValue<string>> = useMemo(() => {
      const filters = [
        (item: string) => item !== NULL_GROUP_BY_VALUE,
        (item: string) => item.toLowerCase().includes(searchValue.toLowerCase()),
      ];

      return labels.filter((item) => filters.every((filter) => filter(item.value as string))) as Array<
        SelectableValue<string>
      >;
    }, [labels, searchValue]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchValue('');
      }
    };

    return (
      <div className={styles.container}>
        <h5 className={styles.header}>
          Breakdown by label
          <span className={styles.count}>({loading ? '0' : labels.length})</span>
        </h5>

        <Input
          className={styles.search}
          prefix={<Icon name="search" />}
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          suffix={
            <IconButton name="times" variant="secondary" tooltip="Clear search" onClick={(e) => setSearchValue('')} />
          }
        />

        {loading && <Spinner inline />}
        {!loading && !filteredList.length && <div className={styles.noResults}>No results.</div>}

        {!loading && filteredList.length > 0 && (
          <>
            <div className={styles.listHeader}>
              <div>{value === NULL_GROUP_BY_VALUE ? 'No selection' : `Selected: "${value}"`}</div>
              <Button
                className={styles.clearButton}
                variant="secondary"
                fill="text"
                onClick={() => labelsVariable.changeValueTo(NULL_GROUP_BY_VALUE)}
                disabled={value === NULL_GROUP_BY_VALUE}
              >
                clear
              </Button>
            </div>
            <RadioButtonList
              name="labels-list"
              className={styles.list}
              options={filteredList}
              onChange={model.onClickLabel}
              value={value as string}
            />
          </>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      width: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
      background: theme.colors.background.primary,
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      marginBottom: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    }),
    count: css({
      display: 'inline-block',
      color: theme.colors.text.secondary,
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
    }),
    search: css({
      marginBottom: theme.spacing(1),
      padding: theme.spacing(0, 0.5),
    }),
    listHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      margin: theme.spacing(0),
      padding: theme.spacing(0, 0, 0, 1),
    }),
    clearButton: css({}),
    list: css({
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      gap: 0,
      overflowY: 'auto',

      '& label': {
        cursor: 'pointer',
        padding: theme.spacing(0.75, 1),
        '&:hover': {
          background: theme.colors.background.secondary,
        },
      },
    }),
    noResults: css({
      fontStyle: 'italic',
      marginTop: theme.spacing(2),
    }),
  };
}

export default LabelsBrowser;
