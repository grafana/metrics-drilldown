import { dateTime, type RawTimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv, hasPermission } from '@grafana/runtime';
import { sceneGraph, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type DataSourceRef, type Panel } from '@grafana/schema';
import { cloneDeep } from 'lodash';

import { getPanelData } from '../addToDashboard/addToDashboard';

export const ADD_TO_NOTEBOOK_COMPONENT_ID = 'grafana/add-to-notebook-form/v1';

export interface CapturedTimeRange {
  from: string;
  to: string;
  timeZone?: string;
}

export interface AddToNotebookFormProps {
  onClose: () => void;
  buildPanel: () => Panel;
  capturedTimeRange: CapturedTimeRange;
}

export interface NotebookCapture {
  panel: Panel;
  capturedTimeRange: CapturedTimeRange;
}

export function getAddToNotebookLabel() {
  return t('panel-menu.action.add-to-notebook', 'Add to notebook');
}

export function canAddToNotebook() {
  return hasPermission('notebooks:create') || hasPermission('notebooks:write');
}

export function buildNotebookCapture(vizPanel: VizPanel): NotebookCapture {
  if (!(sceneGraph.getData(vizPanel) instanceof SceneQueryRunner)) {
    throw new Error('Notebook capture requires a direct query runner without custom data transformations');
  }

  const { panel, range } = getPanelData(vizPanel);
  const datasource = panel.datasource?.uid ? getDataSourceSrv().getInstanceSettings(panel.datasource.uid) : undefined;
  if (!datasource || datasource.type !== 'prometheus' || !panel.targets?.length) {
    throw new Error('Notebook capture requires resolved Prometheus queries and a datasource');
  }

  panel.datasource = { uid: datasource.uid, type: datasource.type };
  panel.targets = panel.targets.map((target) => {
    const targetDatasource = target.datasource as DataSourceRef | undefined;
    const targetUid = targetDatasource?.uid ? sceneGraph.interpolate(vizPanel, targetDatasource.uid) : datasource.uid;
    if (targetUid !== datasource.uid || typeof target.expr !== 'string' || !target.expr.trim()) {
      throw new Error('Notebook capture requires PromQL queries from the panel datasource');
    }
    if (/\$(?:\{)?(?!__)[a-zA-Z_]\w*/.test(target.expr)) {
      throw new Error('Notebook capture cannot preserve unresolved scene variables');
    }
    return { ...target, datasource: panel.datasource };
  });

  const timeZone = sceneGraph.getTimeRange(vizPanel).getTimeZone();
  return {
    panel: cloneDeep(panel),
    capturedTimeRange: {
      from: captureTime(range.raw.from),
      to: captureTime(range.raw.to),
      timeZone: !timeZone || timeZone === 'browser' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timeZone,
    },
  };
}

function captureTime(value: RawTimeRange['from']): string {
  if (typeof value === 'string') {
    if (value.startsWith('now')) {
      return value;
    }
    const absolute = /^\d+$/.test(value) ? Number(value) : value;
    return dateTime(absolute).toISOString();
  }
  return value.toISOString();
}
