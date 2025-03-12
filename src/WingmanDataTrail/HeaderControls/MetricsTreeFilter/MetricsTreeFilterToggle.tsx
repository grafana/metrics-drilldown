import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { MetricsTreeFilter, type ExtraMetricsTreeFilterProps } from './MetricsTreeFilter';
import { Dropdown } from '../MetricsFilter/Dropdown';
import { EventGroupFiltersChanged } from '../MetricsFilter/EventGroupFiltersChanged';

interface MetricsTreeFilterToggleState extends SceneObjectState {
  body: MetricsTreeFilter;
}

export class MetricsTreeFilterToggle extends SceneObjectBase<MetricsTreeFilterToggleState> {
  constructor(state: Partial<MetricsTreeFilterToggleState>) {
    super({
      ...state,
      key: 'MetricsTreeFilterToggle',
      body: new MetricsTreeFilter({}),
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
    const { body } = model.useState();

    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const icon = isOverlayOpen ? 'angle-up' : 'angle-down';

    const bodyProps: SceneComponentProps<MetricsTreeFilter> & ExtraMetricsTreeFilterProps = {
      model: body,
      onClickApply: (selectedNodeIds: string[]) => {
        model.onApplyFilters(selectedNodeIds);
        setIsOverlayOpen(false);
      },
      onClickCancel() {
        setIsOverlayOpen(false);
      },
    };

    return (
      <div className={styles.container}>
        <Dropdown isOpen={isOverlayOpen} overlay={<body.Component {...bodyProps} />} onVisibleChange={setIsOverlayOpen}>
          <Button variant="secondary" fill="outline">
            <>
              <Icon name="filter" />
              &nbsp;Metrics tree filters&nbsp;
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
