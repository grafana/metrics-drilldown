// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// React 19 requires MessageChannel which is not available in jsdom
const { MessageChannel } = require('worker_threads');
global.MessageChannel = MessageChannel;

const mockIntersectionObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn().mockImplementation((elem) => {
    callback([{ target: elem, isIntersecting: true }]);
  }),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
global.IntersectionObserver = mockIntersectionObserver;

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
