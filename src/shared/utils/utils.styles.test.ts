import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getResponsiveBreakpoints } from './utils.styles';

jest.mock('@grafana/runtime', () => ({
  config: {
    buildInfo: { version: '0.0.0' },
  },
}));

const mockConfig = config as jest.Mocked<typeof config>;

const mockContainerBreakpoints = {} as GrafanaTheme2['breakpoints'];
const mockTheme = {
  breakpoints: {
    container: mockContainerBreakpoints,
  },
} as unknown as GrafanaTheme2;

beforeEach(() => {
  mockConfig.buildInfo = { version: '0.0.0' } as typeof config.buildInfo;
});

describe('getResponsiveBreakpoints', () => {
  describe('Grafana >= 12.4.0', () => {
    it('returns theme.breakpoints.container for version 12.4.0', () => {
      mockConfig.buildInfo = { version: '12.4.0' } as typeof config.buildInfo;

      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockContainerBreakpoints);
    });

    it('returns theme.breakpoints.container for version > 12.4.0', () => {
      mockConfig.buildInfo = { version: '12.5.0' } as typeof config.buildInfo;

      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockContainerBreakpoints);
    });
  });

  describe('Grafana < 12.4.0', () => {
    it('returns theme.breakpoints for version < 12.4.0', () => {
      mockConfig.buildInfo = { version: '12.3.9' } as typeof config.buildInfo;

      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockTheme.breakpoints);
    });

    it('returns theme.breakpoints when version is undefined (defaults to 0.0.0)', () => {
      mockConfig.buildInfo = { version: undefined } as unknown as typeof config.buildInfo;

      expect(getResponsiveBreakpoints(mockTheme)).toBe(mockTheme.breakpoints);
    });
  });
});
