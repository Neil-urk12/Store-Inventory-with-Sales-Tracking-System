import { config } from '@vue/test-utils';
import { Quasar } from 'quasar';
import * as components from 'quasar';
import { vi } from 'vitest';

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: vi.fn(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
  })),
  registerables: [],
}));

// Mock canvas
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Global mocks
global.ResizeObserver = MockResizeObserver;
global.HTMLCanvasElement.prototype.getContext = () => ({
  canvas: {
    width: 100,
    height: 100,
  },
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
});

// Global Quasar configuration
config.global.plugins = [[Quasar, {
  components,
  plugins: {},
}]];

// Mock console methods
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
}
