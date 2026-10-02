import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

import { SyncYAxisSwitch } from './SyncYAxisSwitch';

describe('SyncYAxisSwitch', () => {
  beforeEach(() => {
    userStorage.clear();
  });

  it('is enabled by default when no preference is stored', () => {
    expect(new SyncYAxisSwitch().state.enabled).toBe(true);
  });

  it('restores a stored preference', () => {
    userStorage.setItem(PREF_KEYS.BREAKDOWN_SYNC_YAXIS, false);

    expect(new SyncYAxisSwitch().state.enabled).toBe(false);
  });

  it('falls back to enabled when the stored value is not a boolean', () => {
    userStorage.setItem(PREF_KEYS.BREAKDOWN_SYNC_YAXIS, 'nope');

    expect(new SyncYAxisSwitch().state.enabled).toBe(true);
  });

  it('updates its state and persists the preference on change', () => {
    const syncYAxisSwitch = new SyncYAxisSwitch();

    syncYAxisSwitch.onChange(false);

    expect(syncYAxisSwitch.state.enabled).toBe(false);
    expect(userStorage.getItem(PREF_KEYS.BREAKDOWN_SYNC_YAXIS)).toBe(false);
  });
});
