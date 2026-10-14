import { genBookmarkKey } from './genBookmarkKey';

describe('genBookmarkKey(urlValues)', () => {
  const urlValues = () => ({ metric: 'http_requests_total', 'var-ds': 'prom' });

  it('ignores the exemplars param, so toggling it does not change which bookmark a view matches', () => {
    expect(genBookmarkKey({ ...urlValues(), exemplars: 'true' })).toBe(genBookmarkKey(urlValues()));
  });

  it('still tells different metrics apart', () => {
    expect(genBookmarkKey({ ...urlValues(), metric: 'go_goroutines' })).not.toBe(genBookmarkKey(urlValues()));
  });
});
