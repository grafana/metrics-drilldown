import { config } from '@grafana/runtime';
import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { logger } from 'shared/logger/logger';

import { LOGS_METRIC } from '../shared';

export {
  embeddedTrailNamespace,
  getTrailFor,
  getUrlForTrail,
  limitAdhocProviders,
  newMetricsTrail,
} from './utils.trail';

export function getMetricName(metric?: string) {
  if (!metric) {
    return 'All metrics';
  }

  if (metric === LOGS_METRIC) {
    return 'Logs';
  }

  return metric;
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

interface SceneType<T> extends Function {
  new (...args: never[]): T;
}

export function findObjectOfType<T extends SceneObject>(
  scene: SceneObject,
  check: (obj: SceneObject) => boolean,
  returnType: SceneType<T>
) {
  const obj = sceneGraph.findObject(scene, check);
  if (obj instanceof returnType) {
    return obj;
  } else if (obj !== null) {
    logger.warn(`invalid return type: ${returnType.toString()}`);
  }

  return null;
}

export function noOp() {}

/**
 * Helper function to cast `Object.values` to the correct, narrowed type
 * @param obj - The object to get the values from
 * @returns The values of the object
 */
export function getObjectValues<T extends Record<string, unknown>>(obj: T): ReadonlyArray<T[keyof T]> {
  return Object.values(obj) as ReadonlyArray<T[keyof T]>;
}
