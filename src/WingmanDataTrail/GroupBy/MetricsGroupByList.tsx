import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  SceneReactObject,
  SceneVariableSet,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { InlineBanner } from 'App/InlineBanner';
import { LabelValuesVariable, VAR_LABEL_VALUES } from 'WingmanDataTrail/Labels/LabelValuesVariable';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';
import { ShowMoreButton } from 'WingmanDataTrail/ShowMoreButton';

import { MetricsGroupByRow } from './MetricsGroupByRow';

interface MetricsGroupByListState extends SceneObjectState {
  labelName: string;
  $variables: SceneVariableSet;
  body: SceneByVariableRepeater;
}

export class MetricsGroupByList extends SceneObjectBase<MetricsGroupByListState> {
  constructor({ labelName }: { labelName: MetricsGroupByListState['labelName'] }) {
    super({
      key: 'metrics-group-list',
      labelName,
      $variables: new SceneVariableSet({
        variables: [new LabelValuesVariable({ labelName })],
      }),
      body: new SceneByVariableRepeater({
        variableName: VAR_LABEL_VALUES,
        initialPageSize: 20,
        pageSizeIncrement: 10,
        body: new SceneCSSGridLayout({
          children: [],
          isLazy: true,
          templateColumns: '1fr',
          autoRows: 'auto',
          rowGap: 1,
        }),
        getLayoutLoading: () =>
          new SceneReactObject({
            reactNode: <Spinner inline />,
          }),
        getLayoutEmpty: () =>
          new SceneReactObject({
            reactNode: (
              <InlineBanner title="" severity="info">
                No label values found for label &quot;{labelName}&quot;.
              </InlineBanner>
            ),
          }),
        getLayoutError: (error: Error) =>
          new SceneReactObject({
            reactNode: (
              <InlineBanner severity="error" title={`Error while loading label "${labelName}" values!`} error={error} />
            ),
          }),
        getLayoutChild: (option, index, options) => {
          return new SceneCSSGridItem({
            body: new MetricsGroupByRow({
              index,
              labelName,
              labelValue: option.value as string,
              labelCardinality: options.length,
            }),
          });
        },
      }),
    });
  }

  static readonly Component = ({ model }: SceneComponentProps<MetricsGroupByList>) => {
    const styles = useStyles2(getStyles);
    const { body, $variables, labelName } = model.useState();

    const variable = $variables.state.variables[0] as LabelValuesVariable;
    const { loading, error } = variable.useState();

    const batchSizes = body.useSizes();
    const shouldDisplayShowMoreButton =
      !loading && !error && batchSizes.total > 0 && batchSizes.current < batchSizes.total;

    const onClickShowMore = () => {
      body.increaseBatchSize();
    };

    return (
      <div data-testid="metrics-groupby-list">
        <body.Component model={body} />

        {shouldDisplayShowMoreButton && (
          <div className={styles.footer}>
            <ShowMoreButton label={`"${labelName}" value`} batchSizes={batchSizes} onClick={onClickShowMore} />
          </div>
        )}

        {/* required to trigger its activation handlers */}
        <div className={styles.variable}>
          <variable.Component key={variable.state.name} model={variable} />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    footer: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      margin: theme.spacing(3, 0, 1, 0),

      '& button': {
        height: '40px',
      },
    }),
    variable: css({
      display: 'none',
    }),
  };
}
