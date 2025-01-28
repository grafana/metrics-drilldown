import { BusEventWithPayload } from '@grafana/data';

interface ShowModalReactPayload {
  component: React.ComponentType<any>;
  props?: any;
}

export class ShowModalReactEvent extends BusEventWithPayload<ShowModalReactPayload> {
  static type = 'show-react-modal';
}
