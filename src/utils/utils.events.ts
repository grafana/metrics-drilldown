import { BusEventWithPayload } from '@grafana/data';

interface ShowModalReactPayload {
  component: React.ComponentType<any>;
  props?: any;
}

export class ShowModalReactEvent extends BusEventWithPayload<ShowModalReactPayload> {
  static readonly type = 'show-react-modal';
}
