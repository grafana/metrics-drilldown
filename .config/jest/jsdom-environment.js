const { TestEnvironment } = require('jest-environment-jsdom');

// jsdom v26 (bundled with jest-environment-jsdom v30) makes window.location
// non-configurable, preventing tests from mocking it via Object.defineProperty.
// This custom environment exposes jsdom's reconfigure API as a global function
// so tests can change the URL at runtime.
class JSDOMEnvironmentWithReconfigure extends TestEnvironment {
  async setup() {
    await super.setup();

    this.global.__setWindowLocation = (urlOrProps) => {
      if (typeof urlOrProps === 'string') {
        this.dom.reconfigure({ url: urlOrProps });
        return;
      }

      const current = this.global.location;
      const base = `${current.protocol}//${current.host}`;
      const pathname = urlOrProps.pathname ?? current.pathname;
      const search = urlOrProps.search ?? current.search;
      const hash = urlOrProps.hash ?? current.hash;

      if (urlOrProps.host) {
        const protocol = urlOrProps.protocol ?? current.protocol;
        this.dom.reconfigure({ url: `${protocol}//${urlOrProps.host}${pathname}${search}${hash}` });
      } else {
        this.dom.reconfigure({ url: `${base}${pathname}${search}${hash}` });
      }
    };
  }
}

module.exports = JSDOMEnvironmentWithReconfigure;
