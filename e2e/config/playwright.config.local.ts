import { config } from './playwright.config.common';

export default config({
  reporter: [
    ['list', { printSteps: true }],
    ['html', { outputFolder: '../test-reports', open: 'never' }],
  ],
  workers: 4,
  forbidOnly: false,
});
