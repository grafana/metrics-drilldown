import { isJevDebugEnabled, isJevEnabled } from './toggles';

describe('Jev toggles', () => {
  beforeEach(() => localStorage.clear());

  it('requires explicit localStorage opt-in', () => {
    expect(isJevEnabled()).toBe(false);
    localStorage.setItem('gmd.jev.enabled', '1');
    expect(isJevEnabled()).toBe(true);
    localStorage.setItem('gmd.jev.debug', '1');
    expect(isJevDebugEnabled()).toBe(true);
  });
});
