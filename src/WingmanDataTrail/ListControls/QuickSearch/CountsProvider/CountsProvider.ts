import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

export type CountsData = {
  current: number;
  total: number;
};

export interface CountsProviderState extends SceneObjectState {
  counts: CountsData;
}

export class CountsProvider<T extends CountsProviderState = CountsProviderState> extends SceneObjectBase<T> {
  constructor(state: Partial<T>) {
    super({
      ...state,
      counts: { current: 0, total: 0 },
    } as T);
  }

  public useCounts(): CountsData {
    return this.useState().counts;
  }
}
