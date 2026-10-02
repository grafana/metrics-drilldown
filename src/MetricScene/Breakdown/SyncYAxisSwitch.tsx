import { css } from '@emotion/css';
import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Field, InlineSwitch, useStyles2 } from '@grafana/ui';
import React from 'react';

import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

export interface SyncYAxisSwitchState extends SceneObjectState {
  enabled: boolean;
}

/**
 * Global on/off setting for the syncYAxis behavior in the Breakdown tab, persisted across sessions.
 * LabelBreakdownScene owns the single instance and rebuilds its body when the value changes.
 */
export class SyncYAxisSwitch extends SceneObjectBase<SyncYAxisSwitchState> {
  constructor() {
    const stored = userStorage.getItem(PREF_KEYS.BREAKDOWN_SYNC_YAXIS);

    super({
      key: 'breakdown-sync-y-axis',
      enabled: typeof stored === 'boolean' ? stored : true,
    });
  }

  public onChange = (enabled: boolean) => {
    this.setState({ enabled });
    userStorage.setItem(PREF_KEYS.BREAKDOWN_SYNC_YAXIS, enabled);
  };

  public static readonly Component = ({ model }: SceneComponentProps<SyncYAxisSwitch>) => {
    const styles = useStyles2(getStyles);
    const { enabled } = model.useState();

    return (
      <Field
        className={styles.field}
        label={t('breakdown.sync-y-axis.label', 'Sync y-axis')}
        htmlFor="breakdown-sync-y-axis"
        data-testid="breakdown-sync-y-axis"
      >
        <InlineSwitch
          id="breakdown-sync-y-axis"
          value={enabled}
          onChange={(e) => model.onChange(e.currentTarget.checked)}
        />
      </Field>
    );
  };
}

function getStyles() {
  return {
    field: css({
      marginBottom: 0,
    }),
  };
}
