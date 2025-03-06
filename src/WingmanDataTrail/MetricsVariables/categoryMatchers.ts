export const CATEGORY_MATCHERS = new Map([
  ['cpu', { label: 'CPU usage', match: (value: string) => /[^a-z](cpu)[^a-z]?/i.test(value) }],
  ['memory', { label: 'Memory usage', match: (value: string) => /[^a-z](memory|mem|heap)[^a-z]?/i.test(value) }],
  ['response-time', { label: 'Response time', match: (value: string) => /(duration|latency|time|wait)/i.test(value) }],
  [
    'load',
    {
      label: 'Load',
      match: (value: string) => /[^a-z](load|goroutines|thread|connections|requests|transactions)[^a-z]?/i.test(value),
    },
  ],
  [
    'network',
    {
      label: 'Network traffic',
      match: (value: string) =>
        /[^a-z](network|packets|transport|rx|tx|request_size|response_size)[^a-z]?/i.test(value),
    },
  ],
  ['queues', { label: 'Queues', match: (value: string) => /[^a-z](kafka|consumer|queue)[^a-z]?/i.test(value) }],
  ['databases', { label: 'Databases', match: (value: string) => /[^a-z](query|db|sql|storage)[^a-z]?/i.test(value) }],
  [
    'files',
    { label: 'File system', match: (value: string) => /[^a-z](disk|fs|file|files|filesystem)[^a-z]?/i.test(value) },
  ],
  [
    'errors',
    {
      label: 'Errors',
      match: (value: string) => /[^a-z](error|errors|failed|fail|fault|failure)[^a-z]?/i.test(value),
    },
  ],
  ['k8s', { label: 'Kubernetes', match: (value: string) => /(kube|kubelet|kubernetes|k8s)/i.test(value) }],
]);
