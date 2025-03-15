import { css } from '@emotion/css';
import {
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  SceneReactObject,
  SceneVariableSet,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { LabelValuesVariable, VAR_LABEL_VALUES } from 'WingmanDataTrail/Labels/LabelValuesVariable';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';

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
        initialPageSize: Number.POSITIVE_INFINITY,
        body: new SceneCSSGridLayout({
          children: [],
          isLazy: true,
          templateColumns: '1fr',
          autoRows: 'auto',
        }),
        getLayoutLoading: () =>
          new SceneReactObject({
            reactNode: <Spinner inline />,
          }),
        getLayoutEmpty: () =>
          new SceneReactObject({
            reactNode: (
              <Alert title="" severity="info">
                No label values found for label &quot;{labelName}&quot;.
              </Alert>
            ),
          }),
        getLayoutError: (error: Error) =>
          new SceneReactObject({
            reactNode: (
              <Alert severity="error" title={`Error while loading label "${labelName}" values!`}>
                <p>&quot;{error.message || error.toString()}&quot;</p>
                <p>Please try to reload the page. Sorry for the inconvenience.</p>
              </Alert>
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

  static Component = ({ model }: SceneComponentProps<MetricsGroupByList>) => {
    const styles = useStyles2(getStyles);
    const { body, $variables } = model.useState();

    const variable = $variables.state.variables[0] as LabelValuesVariable;

    return (
      <>
        <body.Component model={body} />
        {/* required to trigger its activation handlers */}
        <div className={styles.variable}>
          <variable.Component key={variable.state.name} model={variable} />
        </div>
      </>
    );
  };
}

function getStyles() {
  return {
    variable: css({
      display: 'none',
    }),
  };
}
