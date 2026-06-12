import { getBuildInfoIcon } from './PluginInfo';

describe('getBuildInfoIcon', () => {
  const buildInfo = {
    application: 'Prometheus',
    version: '3.0.0',
    repository: 'https://github.com/prometheus/prometheus',
    revision: 'abc123',
  };

  it('uses the Prometheus icon by default', () => {
    expect(getBuildInfoIcon(buildInfo)).toBe('prometheus');
  });

  it('uses the Elasticsearch icon when the application is Elasticsearch', () => {
    expect(getBuildInfoIcon({ ...buildInfo, application: 'Elasticsearch' })).toBe('elasticsearch');
  });

  it('uses the Elasticsearch icon when the datasource type is Elasticsearch', () => {
    expect(getBuildInfoIcon({ ...buildInfo, dataSourceType: 'elasticsearch' })).toBe('elasticsearch');
  });

  it('uses the Elasticsearch icon when the build info repository is Elasticsearch', () => {
    expect(getBuildInfoIcon({ ...buildInfo, repository: 'https://github.com/elastic/elasticsearch' })).toBe(
      'elasticsearch'
    );
  });
});
