// react-router's SSR route-module loader uses `import.meta.hot`, which is invalid
// in Jest's CommonJS environment (and @swc/jest does not rewrite `import.meta`).
// Only react-router's SSR/HMR code paths import this module, and this plugin renders
// entirely client-side inside Grafana's router, so a stub is safe here.
module.exports = {
  loadRouteModule: () => Promise.resolve({}),
};
