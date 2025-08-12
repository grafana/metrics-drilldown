import { type ValueMapping } from '@grafana/data';
import { MappingType } from '@grafana/schema';

export const valueMappings: ValueMapping[] = [
  {
    type: MappingType.ValueToText,
    options: {
      '0': {
        color: 'red',
        text: 'down',
      },
      '1': {
        color: 'green',
        text: 'up',
      },
    },
  },
] as const;
