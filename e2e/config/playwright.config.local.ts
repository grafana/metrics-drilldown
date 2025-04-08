import { config } from './playwright.config.common';

export default config({
  reporter: [['list', { printSteps: true }]],
  workers: 4,
});
