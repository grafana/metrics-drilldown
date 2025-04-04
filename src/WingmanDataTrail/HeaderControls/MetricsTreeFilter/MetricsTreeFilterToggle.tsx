import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { MetricsTreeFilter, type MetricsTreeFilterProps } from './MetricsTreeFilter';
import { Dropdown } from '../MetricsFilter/Dropdown';
import { EventGroupFiltersChanged } from '../MetricsFilter/EventGroupFiltersChanged';

interface MetricsTreeFilterToggleState extends SceneObjectState {
  body: MetricsTreeFilter;
  recordingRulesBody: MetricsTreeFilter;
}

export class MetricsTreeFilterToggle extends SceneObjectBase<MetricsTreeFilterToggleState> {
  constructor(state: Partial<MetricsTreeFilterToggleState>) {
    super({
      ...state,
      key: 'MetricsTreeFilterToggle',
      body: new MetricsTreeFilter({}),
      recordingRulesBody: new MetricsTreeFilter({ recordingRulesOnly: true }),
    });
  }

  private onApplyFilters = (selectedNodeIds: string[]) => {
    this.publishEvent(
      new EventGroupFiltersChanged({
        type: 'names',
        groups: selectedNodeIds,
      }),
      true
    );
  };

  public static Component = ({ model }: SceneComponentProps<MetricsTreeFilterToggle>) => {
    const styles = useStyles2(getStyles);
    const { body, recordingRulesBody } = model.useState();

    const [openOverlay, setOpenOverlay] = useState<'metrics' | 'recordingRules' | null>(null);

    const icon = openOverlay ? 'angle-up' : 'angle-down';

    const toggleOverlay = (overlay: 'metrics' | 'recordingRules') => () => {
      setOpenOverlay(overlay === openOverlay ? null : overlay);
    };

    const renderFilterComponent = (
      filterModel: MetricsTreeFilter,
      onApply: (selectedNodeIds: string[]) => void,
      onCancel: () => void
    ) => {
      const Component = filterModel.Component as React.ComponentType<MetricsTreeFilterProps>;
      return <Component model={filterModel} onClickApply={onApply} onClickCancel={onCancel} />;
    };

    return (
      <div className={styles.container}>
        <Dropdown
          isOpen={openOverlay === 'metrics'}
          overlay={renderFilterComponent(body, model.onApplyFilters, () => setOpenOverlay(null))}
          onVisibleChange={toggleOverlay('metrics')}
        >
          <Button variant="secondary" fill="outline">
            <>
              <Icon name="list-ui-alt" />
              &nbsp;Metrics tree filters&nbsp;
              <Icon name={icon} />
            </>
          </Button>
        </Dropdown>
        <Dropdown
          isOpen={openOverlay === 'recordingRules'}
          overlay={renderFilterComponent(recordingRulesBody, model.onApplyFilters, () => setOpenOverlay(null))}
          onVisibleChange={toggleOverlay('recordingRules')}
        >
          <Button variant="secondary" fill="outline">
            <>
              <Icon name="list-ui-alt" />
              &nbsp;Recording rules tree filters&nbsp;
              <Icon name={icon} />
            </>
          </Button>
        </Dropdown>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
    `,
  };
}
