export const CATEGORY_MATCHERS = new Map<string, { label: string; regex: RegExp; match: (value: string) => boolean }>([
  [
    'cpu',
    {
      label: 'CPU usage',
      regex: /[^a-z](cpu)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'memory',
    {
      label: 'Memory usage',
      regex: /[^a-z](memory|mem|heap)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'response-time',
    {
      label: 'Response time',
      regex: /(duration|latency|time|wait)/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'load',
    {
      label: 'Load',
      regex: /[^a-z](load|goroutines|thread|connections|requests|transactions)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'network',
    {
      label: 'Network traffic',
      regex: /[^a-z](network|packets|transport|rx|tx|request_size|response_size)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'queues',
    {
      label: 'Queues',
      regex: /[^a-z](kafka|consumer|queue)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'databases',
    {
      label: 'Databases',
      regex: /[^a-z](query|db|sql|storage)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'files',
    {
      label: 'File system',
      regex: /[^a-z](disk|fs|file|files|filesystem)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'errors',
    {
      label: 'Errors',
      regex: /[^a-z](error|errors|failed|fail|fault|failure)[^a-z]?/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
  [
    'k8s',
    {
      label: 'Kubernetes',
      regex: /(kube|kubelet|kubernetes|k8s)/i,
      match(value: string) {
        return this.regex.test(value);
      },
    },
  ],
]);
