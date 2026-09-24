import { type GrafanaTheme2 } from '@grafana/data';

const mockContainerBreakpoints = {} as GrafanaTheme2['breakpoints'];
const mockTheme = {
  breakpoints: {
    container: mockContainerBreakpoints,
  },
} as unknown as GrafanaTheme2;

type UtilsStylesModule = {
  getResponsiveBreakpoints: (theme: GrafanaTheme2) => GrafanaTheme2['breakpoints'];
  getAppBackgroundColor: (theme: GrafanaTheme2, embedded?: boolean) => string | undefined;
};

function loadWithVersion(version: string | undefined) {
  jest.resetModules();
  jest.doMock('@grafana/runtime', () => ({
    config: { buildInfo: { version } },
  }));
  return require('./utils.styles') as UtilsStylesModule;
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

describe('getAppBackgroundColor', () => {
  // page and primary are intentionally given different values: in the "Visual Refresh (Dark)" theme
  // (flag on), they are genuinely different colors (page: #090b0f, primary: #111419) -- they are NOT
  // interchangeable, unlike in the pre-refresh theme where they happened to match.
  const page = 'page-background';
  const primary = 'primary-background';
  const canvas = 'canvas-background';

  function getColor(visualDesignRefresh: boolean | undefined, embedded?: boolean) {
    const theme = {
      colors: { background: { page, primary, canvas } },
      flags: { visualDesignRefresh },
    } as unknown as GrafanaTheme2;

    return loadWithVersion(undefined).getAppBackgroundColor(theme, embedded);
  }

  it.each([
    { embedded: true, visualDesignRefresh: true, expected: primary },
    { embedded: true, visualDesignRefresh: false, expected: primary },
    { embedded: false, visualDesignRefresh: true, expected: page },
    { embedded: false, visualDesignRefresh: false, expected: canvas },
    { embedded: false, visualDesignRefresh: undefined, expected: canvas },
  ])(
    'returns $expected for embedded=$embedded and visualDesignRefresh=$visualDesignRefresh',
    ({ embedded, visualDesignRefresh, expected }) => {
      expect(getColor(visualDesignRefresh, embedded)).toBe(expected);
    }
  );
});
