import { css } from '@emotion/css';
import { type GrafanaTheme2, type IconName, type SelectableValue } from '@grafana/data';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Icon, IconButton, Input, RadioButtonList, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';

import { SectionTitle } from './SectionTitle';

interface LabelsBrowserState extends SceneObjectState {
  key: string;
  variableName: string;
  title: string;
  description: string;
  iconName: IconName;
  disabled: boolean;
}

export class LabelsBrowser extends SceneObjectBase<LabelsBrowserState> {
  constructor({
    key,
    variableName,
    title,
    description,
    iconName,
    disabled,
  }: {
    key: LabelsBrowserState['key'];
    variableName: LabelsBrowserState['variableName'];
    title: LabelsBrowserState['title'];
    description: LabelsBrowserState['description'];
    iconName: LabelsBrowserState['iconName'];
    disabled?: LabelsBrowserState['disabled'];
  }) {
    super({
      key,
      variableName,
      title,
      description,
      iconName,
      disabled: disabled ?? false,
    });
  }

  onClickLabel = (value: string) => {
    const labelsVariable = sceneGraph.lookupVariable(this.state.variableName, this) as LabelsVariable;
    labelsVariable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<LabelsBrowser>) => {
    const styles = useStyles2(getStyles);
    const { variableName, title, description } = model.useState();

    const labelsVariable = sceneGraph.lookupVariable(variableName, model) as LabelsVariable;
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
      <div className={styles.container} data-testid="labels-browser">
        <SectionTitle title={title} description={description} />

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
              <div className={styles.selected}>
                {value === NULL_GROUP_BY_VALUE ? 'No selection' : `Selected: "${value}"`}
              </div>
              <Button
                variant="secondary"
                fill="text"
                onClick={() => labelsVariable.changeValueTo(NULL_GROUP_BY_VALUE)}
                disabled={value === NULL_GROUP_BY_VALUE}
              >
                clear
              </Button>
            </div>
            <div className={styles.list} data-testid="labels-list">
              {/* TODO: use a custom one to have option labels with ellipsis and title/tooltip when hovering
              now we're customizing too much the component CSS */}
              <RadioButtonList
                name="labels-list"
                options={filteredList}
                onChange={model.onClickLabel}
                value={value as string}
              />
            </div>
          </>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
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
      marginTop: theme.spacing(2),
    }),
  };
}

export default LabelsBrowser;
