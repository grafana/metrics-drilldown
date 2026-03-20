const { TestEnvironment } = require('jest-environment-jsdom');

// jsdom v26 (bundled with jest-environment-jsdom v30) makes window.location
// non-configurable per the HTML spec's [Unforgeable] attribute, preventing tests
// from mocking it via Object.defineProperty or jest.spyOn.
//
// This custom environment exposes jsdom's reconfigure() API as a global
// __setWindowLocation() so tests can change the URL at runtime.
class JSDOMEnvironmentWithReconfigure extends TestEnvironment {
  async setup() {
    await super.setup();

    this.global.__setWindowLocation = (urlOrProps) => {
      if (typeof urlOrProps === 'string') {
        this.dom.reconfigure({ url: urlOrProps });
        return;
      }

      const current = this.global.location;
      const protocol = urlOrProps.protocol ?? current.protocol;
      const host = urlOrProps.host ?? current.host;
      const pathname = urlOrProps.pathname ?? current.pathname;
      const search = urlOrProps.search ?? current.search;
      const hash = urlOrProps.hash ?? current.hash;
      this.dom.reconfigure({ url: `${protocol}//${host}${pathname}${search}${hash}` });
    };
  }
}

module.exports = JSDOMEnvironmentWithReconfigure;
