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
import { Alert, Button, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { LabelValuesVariable, VAR_LABEL_VALUES } from 'WingmanDataTrail/Labels/LabelValuesVariable';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';

import { type MetricsGroupByRow, type MetricsGroupByRowState } from './MetricsGroupByRow';
import { type MetricsGroupByRow as OnboardingMetricsGroupByRow } from '../../WingmanOnboarding/GroupBy/MetricsGroupByRow';

interface MetricsGroupByListState extends SceneObjectState {
  labelName: string;
  $variables: SceneVariableSet;
  body: SceneByVariableRepeater;
}

export class MetricsGroupByList extends SceneObjectBase<MetricsGroupByListState> {
  constructor({
    labelName,
    GroupByRow,
  }: {
    labelName: MetricsGroupByListState['labelName'];
    GroupByRow: new ({
      index,
      labelName,
      labelValue,
      labelCardinality,
    }: {
      index: MetricsGroupByRowState['index'];
      labelName: MetricsGroupByRowState['labelName'];
      labelValue: MetricsGroupByRowState['labelValue'];
      labelCardinality: MetricsGroupByRowState['labelCardinality'];
    }) => MetricsGroupByRow | OnboardingMetricsGroupByRow;
  }) {
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
            body: new GroupByRow({
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
      <>
        <body.Component model={body} />

        {shouldDisplayShowMoreButton && (
          <div className={styles.footer}>
            <Button variant="secondary" fill="outline" onClick={onClickShowMore}>
              Show {batchSizes.increment} more &quot;{labelName}&quot; values ({batchSizes.current}/{batchSizes.total})
            </Button>
          </div>
        )}

        {/* required to trigger its activation handlers */}
        <div className={styles.variable}>
          <variable.Component key={variable.state.name} model={variable} />
        </div>
      </>
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
