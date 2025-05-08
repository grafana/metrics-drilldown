import { type Scope } from '@grafana/data';
import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

export function getSelectedScopes(): Scope[] {
  return [];
}

export function getClosestScopesFacade(): ScopesFacade {
  return new ScopesFacade();
}

interface SelectedScope {
  scope: Scope;
  path: string[];
}

interface ScopesFacadeState extends SceneObjectState {
  // A callback that will be executed when new scopes are set
  handler?: (facade: ScopesFacade) => void;
  // The render count is a workaround to force the URL sync manager to update the URL with the latest scopes
  // Basically it starts at 0, and it is increased with every scopes value update
  renderCount?: number;
}

export class ScopesFacade extends SceneObjectBase<ScopesFacadeState> {
  private selectedScopes: SelectedScope[] = [];
  private onScopesChangeCallbacks: Array<(scopes: SelectedScope[]) => void> = [];

  constructor() {
    super({});
  }

  public getSelectedScopes(): SelectedScope[] {
    return this.selectedScopes;
  }

  public getSelectedScopesNames(): string[] {
    return this.selectedScopes.map(({ scope }) => scope.metadata.name);
  }

  public setSelectedScopes(scopes: SelectedScope[]) {
    this.selectedScopes = scopes;
    this.notifySubscribers();
  }

  public onScopesChange(callback: (scopes: SelectedScope[]) => void) {
    this.onScopesChangeCallbacks.push(callback);
    return () => {
      this.onScopesChangeCallbacks = this.onScopesChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifySubscribers() {
    for (const callback of this.onScopesChangeCallbacks) {
      callback(this.selectedScopes);
    }
  }

  public get value() {
    return getSelectedScopes();
  }
}

export function ScopesSelector(): null {
  return null;
}
