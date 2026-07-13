import React from 'react';
import { render } from '@testing-library/react';
import { PluginPromBuildIcon } from './PluginLogo';

describe('PluginPromBuildIcon', () => {
  it('renders without crashing for Prometheus', () => {
    const { container } = render(
      <PluginPromBuildIcon
        application="Prometheus"
        version="3.0.0"
        repository="https://github.com/prometheus/prometheus"
        revision="abc123"
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders without crashing for Elasticsearch', () => {
    const { container } = render(
      <PluginPromBuildIcon
        application="Elasticsearch"
        version="8.14.0"
        repository="https://github.com/elastic/elasticsearch"
        revision="abc123"
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
