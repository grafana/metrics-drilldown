declare module 'replace-in-file-webpack-plugin' {
  interface ReplaceRule {
    search: string | RegExp;
    replace: string | ((match: string) => string);
  }

  interface ReplaceOption {
    dir?: string;
    files?: string[];
    test?: RegExp | RegExp[];
    rules: ReplaceRule[];
  }

  class ReplaceInFilePlugin {
    constructor(options?: ReplaceOption[]);
    options: ReplaceOption[];
    apply(compiler: any): void;
  }

  export = ReplaceInFilePlugin;
}
