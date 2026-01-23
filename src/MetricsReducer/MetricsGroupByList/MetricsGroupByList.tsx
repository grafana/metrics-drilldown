import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
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

import { SceneByVariableRepeater } from 'MetricsReducer/components/SceneByVariableRepeater';
import { ShowMoreButton } from 'MetricsReducer/components/ShowMoreButton';

import { MetricsGroupByRow } from './MetricsGroupByRow';
import { InlineBanner } from '../../App/InlineBanner';
import { LabelValuesVariable, VAR_LABEL_VALUES } from '../labels/LabelValuesVariable';

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
                {t('metrics-group-by-list.no-values', 'No label values found for label "{{labelName}}".', {
                  labelName,
                })}
              </InlineBanner>
            ),
          }),
        getLayoutError: (error: Error) =>
          new SceneReactObject({
            reactNode: (
              <InlineBanner
                severity="error"
                title={t('metrics-group-by-list.error-title', 'Error while loading label "{{labelName}}" values!', {
                  labelName,
                })}
                error={error}
              />
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
            <ShowMoreButton
              label={t('metrics-group-by-list.show-more-label', '"{{labelName}}" value', { labelName })}
              batchSizes={batchSizes}
              onClick={onClickShowMore}
            />
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
