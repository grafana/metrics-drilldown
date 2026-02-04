import { dateTime, LoadingState } from '@grafana/data';
import { setDataSourceSrv, setRunRequest } from '@grafana/runtime';
import { of } from 'rxjs';

import { QueryResultsScene } from './QueryResultsScene';
import { activateFullSceneTree } from '../../shared/utils/utils.testing';
import { DataSourceType, MockDataSourceSrv } from '../../test/mocks/datasource';

describe('QueryResultsScene', () => {
  beforeAll(() => {
    const dataSourceSrv = new MockDataSourceSrv({
      prom: {
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
        uid: 'ds',
      },
    });
    setDataSourceSrv(dataSourceSrv);
    setRunRequest(() =>
      of({
        state: LoadingState.Done,
        series: [],
        timeRange: {
          from: dateTime(),
          to: dateTime(),
          raw: { from: '', to: '' },
        },
      })
    );
  });

  describe('Scene instantiation', () => {
    it('should create scene with metric name', () => {
      const scene = new QueryResultsScene({ metric: 'test_metric' });
      expect(scene.state.metric).toBe('test_metric');
    });

    it('should have SceneQueryRunner as $data', () => {
      const scene = new QueryResultsScene({ metric: 'test_metric' });
      expect(scene.state.$data).toBeDefined();
    });

    it('should configure instant query', () => {
      const scene = new QueryResultsScene({ metric: 'test_metric' });
      const queries = (scene.state.$data as any)?.state?.queries;
      expect(queries).toBeDefined();
      expect(queries[0]?.instant).toBe(true);
      expect(queries[0]?.format).toBe('table');
    });
  });

  describe('Scene activation', () => {
    it('should activate without errors', () => {
      const scene = new QueryResultsScene({ metric: 'test_metric' });
      expect(() => activateFullSceneTree(scene)).not.toThrow();
    });
  });

  describe('Query expression', () => {
    it('should build query expression with metric name', () => {
      const scene = new QueryResultsScene({ metric: 'http_requests_total' });
      const queries = (scene.state.$data as any)?.state?.queries;
      expect(queries[0]?.expr).toContain('http_requests_total');
    });

    it('should handle counter metrics', () => {
      const scene = new QueryResultsScene({ metric: 'http_requests_total' });
      const queries = (scene.state.$data as any)?.state?.queries;
      // Counter metrics are detected by suffix "_total"
      expect(queries[0]?.expr).toBeDefined();
    });

    it('should handle gauge metrics', () => {
      const scene = new QueryResultsScene({ metric: 'process_cpu_seconds' });
      const queries = (scene.state.$data as any)?.state?.queries;
      expect(queries[0]?.expr).toBeDefined();
    });
  });
});
