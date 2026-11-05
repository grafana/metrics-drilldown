import { BusEventWithPayload } from '@grafana/data';

import { type NotebookCapture } from './notebookCapture';

export class EventOpenAddToNotebook extends BusEventWithPayload<NotebookCapture> {
  public static readonly type = 'open-add-to-notebook';
}
