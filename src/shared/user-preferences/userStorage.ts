import pluginJson from '../../plugin.json';

class UserStorage {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private buildStorageKey(key: string) {
    return `${this.service}.${key}`;
  }

  getItem(key: string): any {
    const storageKey = this.buildStorageKey(key);
    const item = localStorage.getItem(storageKey);
    return item === null ? null : JSON.parse(item);
  }

  setItem(key: string, value: any): void {
    const storageKey = this.buildStorageKey(key);
    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  removeItem(key: string): void {
    const storageKey = this.buildStorageKey(key);
    localStorage.removeItem(storageKey);
  }

  clear() {
    localStorage.clear();
  }
}

export const userStorage = new UserStorage(pluginJson.id);
