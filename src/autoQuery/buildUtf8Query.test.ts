import { Utf8MetricExprBuilder } from './buildUtf8Query';

describe('Utf8MetricExprBuilder', () => {
  describe('metric names with UTF-8 characters', () => {
    it('should handle metric name with UTF-8 characters', () => {
      const builder = new Utf8MetricExprBuilder('test.metric.🎉🎊');
      const result = builder.toString();
      expect(result).toBe('{"test.metric.🎉🎊"}');
    });
  });

  describe('labels with UTF-8 characters in names', () => {
    it('should handle label name with emoji', () => {
      const builder = new Utf8MetricExprBuilder('test_metric', [{ name: '🚀', value: 'value', operator: '=' }]);
      const result = builder.toString();
      expect(result).toBe('{"test_metric","🚀"="value"}');
    });

    it('should handle multiple labels with UTF-8 characters in names', () => {
      const builder = new Utf8MetricExprBuilder('test_metric', [
        { name: '📈', value: 'value1', operator: '=' },
        { name: '📊', value: 'value2', operator: '=' },
      ]);
      const result = builder.toString();
      expect(result).toBe('{"test_metric","📈"="value1","📊"="value2"}');
    });
  });

  describe('range vector expressions', () => {
    it('should handle range vector with UTF-8 metric name', () => {
      const builder = new Utf8MetricExprBuilder('test.metric.🚀', [], '5m');
      const result = builder.toString();
      expect(result).toBe('{"test.metric.🚀"}[5m]');
    });

    it('should handle range vector with UTF-8 label names', () => {
      const builder = new Utf8MetricExprBuilder('test_metric', [{ name: '📈', value: 'value1', operator: '=' }], '5m');
      const result = builder.toString();
      expect(result).toBe('{"test_metric","📈"="value1"}[5m]');
    });
  });
});
