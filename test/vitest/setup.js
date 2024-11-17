import { config } from '@vue/test-utils';
import { Quasar } from 'quasar';
import * as components from 'quasar';

// Global Quasar configuration
config.global.plugins = [[Quasar, {
  components,
  plugins: {},
}]];
