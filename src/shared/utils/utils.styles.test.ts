import { type GrafanaTheme2 } from '@grafana/data';

const mockContainerBreakpoints = {} as GrafanaTheme2['breakpoints'];
const mockTheme = {
  breakpoints: {
    container: mockContainerBreakpoints,
  },
} as unknown as GrafanaTheme2;

function loadWithVersion(version: string | undefined) {
  jest.resetModules();
  jest.doMock('@grafana/runtime', () => ({
    config: { buildInfo: { version } },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./utils.styles') as typeof import('./utils.styles');
}

describe('getResponsiveBreakpoints', () => {
  describe('Grafana >= 12.4.0', () => {
    it('returns theme.breakpoints.container for version 12.4.0', () => {
      const { getResponsiveBreakpoints } = loadWithVersion('12.4.0');
      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockContainerBreakpoints);
    });

    it('returns theme.breakpoints.container for version > 12.4.0', () => {
      const { getResponsiveBreakpoints } = loadWithVersion('12.5.0');
      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockContainerBreakpoints);
    });
  });

  describe('Grafana < 12.4.0', () => {
    it('returns theme.breakpoints for version < 12.4.0', () => {
      const { getResponsiveBreakpoints } = loadWithVersion('12.3.9');
      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockTheme.breakpoints);
    });

    it('returns theme.breakpoints when version is undefined (defaults to 0.0.0)', () => {
      const { getResponsiveBreakpoints } = loadWithVersion(undefined);
      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockTheme.breakpoints);
    });
  });
});
