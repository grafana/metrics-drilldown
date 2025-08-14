import { type ValueMapping } from '@grafana/data';
import { MappingType } from '@grafana/schema';

export const UP_DOWN_VALUE_MAPPINGS: ValueMapping[] = [
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
