import { BusEventWithPayload } from '@grafana/data';

interface EventSectionValueChangedPayload {
  key: string;
  values: string[];
}

export class EventSectionValueChanged extends BusEventWithPayload<EventSectionValueChangedPayload> {
  public static readonly type = 'section-value-changed';
}
