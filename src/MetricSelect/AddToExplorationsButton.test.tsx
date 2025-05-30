import { PluginExtensionTypes } from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';
import { render, screen } from '@testing-library/react';
import React from 'react';

import {
  AddToExplorationButton,
  addToExplorationsButtonLabel,
  investigationsPluginId,
} from './AddToExplorationsButton';
import { mockPluginLinkExtension } from '../mocks/plugin';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
  useChromeHeaderHeight: jest.fn().mockReturnValue(80),
  getBackendSrv: () => {
    return {
      get: jest.fn(),
    };
  },
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({}),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
}));

describe('AddToExplorationButton', () => {
  it("shouldn't render when a plugin extension link isn't provided by the Explorations app", async () => {
    setPluginLinksHook(() => ({
      links: [],
      isLoading: false,
    }));
    const scene = new AddToExplorationButton({});
    render(<scene.Component model={scene} />);
    expect(() => screen.getByLabelText(addToExplorationsButtonLabel)).toThrow();
  });

  it('should render when the Explorations app provides a plugin extension link', async () => {
    setPluginLinksHook(() => ({
      links: [
        mockPluginLinkExtension({
          description: addToExplorationsButtonLabel, // this overrides the aria-label
          onClick: () => {},
          path: '/a/grafana-investigations-app',
          pluginId: investigationsPluginId,
          title: 'Explorations',
          type: PluginExtensionTypes.link,
        }),
      ],
      isLoading: false,
    }));
    const scene = new AddToExplorationButton({});
    render(<scene.Component model={scene} />);
    const button = screen.getByLabelText(addToExplorationsButtonLabel);
    expect(button).toBeInTheDocument();
  });
});
