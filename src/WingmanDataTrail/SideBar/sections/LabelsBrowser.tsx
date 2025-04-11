import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { sceneGraph, SceneObjectBase, type SceneComponentProps } from '@grafana/scenes';
import { Button, Icon, IconButton, Input, RadioButtonList, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';

import { SectionTitle } from './SectionTitle';
import { type SideBarSectionState } from './types';

interface LabelsBrowserState extends SideBarSectionState {
  variableName: string;
}

export class LabelsBrowser extends SceneObjectBase<LabelsBrowserState> {
  constructor({
    key,
    variableName,
    title,
    description,
    icon,
    disabled,
  }: {
    key: LabelsBrowserState['key'];
    variableName: LabelsBrowserState['variableName'];
    title: LabelsBrowserState['title'];
    description: LabelsBrowserState['description'];
    icon: LabelsBrowserState['icon'];
    disabled?: LabelsBrowserState['disabled'];
  }) {
    super({
      key,
      variableName,
      title,
      description,
      icon,
      disabled: disabled ?? false,
      active: false,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const labelsVariable = sceneGraph.lookupVariable(this.state.variableName, this) as LabelsVariable;
    const labelValue = labelsVariable.state.value;

    this.setState({ active: Boolean(labelValue && labelValue !== NULL_GROUP_BY_VALUE) });
  }

  onClickLabel = (value: string) => {
    const labelsVariable = sceneGraph.lookupVariable(this.state.variableName, this) as LabelsVariable;
    labelsVariable.changeValueTo(value);

    this.setState({ active: true });
  };

  onClickClearSelection = () => {
    const labelsVariable = sceneGraph.lookupVariable(this.state.variableName, this) as LabelsVariable;
    labelsVariable.changeValueTo(NULL_GROUP_BY_VALUE);

    this.setState({ active: false });
  };

  useLabelsBrowser = () => {
    const { variableName, title, description } = this.useState();

    const labelsVariable = sceneGraph.lookupVariable(variableName, this) as LabelsVariable;
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

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchValue(e.currentTarget.value);
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchValue('');
      }
    };

    const onInputClear = () => {
      setSearchValue('');
    };

    return {
      title,
      description,
      loading,
      value,
      filteredList,
      searchValue,
      onInputChange,
      onInputKeyDown,
      onInputClear,
    };
  };

  public static Component = ({ model }: SceneComponentProps<LabelsBrowser>) => {
    const styles = useStyles2(getStyles);

    const {
      title,
      description,
      loading,
      value,
      filteredList,
      searchValue,
      onInputChange,
      onInputKeyDown,
      onInputClear,
    } = model.useLabelsBrowser();

    return (
      <div className={styles.container} data-testid="labels-browser">
        <SectionTitle title={title} description={description} />

        <Input
          className={styles.search}
          prefix={<Icon name="search" />}
          placeholder="Search..."
          value={searchValue}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          suffix={<IconButton name="times" variant="secondary" tooltip="Clear search" onClick={onInputClear} />}
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
                onClick={model.onClickClearSelection}
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
