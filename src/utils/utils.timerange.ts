import { dateMath } from '@grafana/data';
import { SceneTimeRange } from '@grafana/scenes';

type MathStringOrUnixTimestamp = string | number;

/**
 * Convert a time string or unix timestamp to a SceneTimeRange.
 *
 * @param time - The time string or unix timestamp.
 * @returns The SceneTimeRange.
 *
 * @example
 * ```ts
 * toSceneTime('now-1h')
 * ```
 *
 * @example
 * ```ts
 * toSceneTime(1723756800000)
 * ```
 */
function toSceneTime(time: MathStringOrUnixTimestamp): string {
  if (typeof time === 'string' && dateMath.isMathString(time)) {
    // 'now', 'now-1h', etc.
    return time;
  }

  return dateMath.toDateTime(new Date(time), { roundUp: false })!.toISOString();
}

/**
 * Convert a time string or unix timestamp to a SceneTimeRange.
 *
 * @param from - The start time.
 * @param to - The end time.
 * @returns The SceneTimeRange.
 *
 * @example
 * ```ts
 * toSceneTimeRange('now-1h', 'now')
 * ```
 *
 * @example
 * ```ts
 * toSceneTimeRange(1723756800000, 1723756800000)
 * ```
 *
 * @example
 * ```ts
 * toSceneTimeRange('now-1h', 1723756800000)
 * ```
 */
export function toSceneTimeRange(from: MathStringOrUnixTimestamp, to: MathStringOrUnixTimestamp): SceneTimeRange {
  return new SceneTimeRange({ from: toSceneTime(from), to: toSceneTime(to) });
}
