let localStore: Record<string, string> = {};

export const userPreferences = {
  getItem: (key: string) => {
    return key in localStore ? JSON.parse(localStore[key]) : null;
  },
  setItem: (key: string, value: any) => {
    localStore[key] = JSON.stringify(value);
  },
  clear: () => {
    localStore = {};
  },
};
