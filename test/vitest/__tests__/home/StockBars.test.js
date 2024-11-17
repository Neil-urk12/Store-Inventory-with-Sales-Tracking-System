import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import StockBars from 'src/components/home/StockBars.vue';
import { useInventoryStore } from 'src/stores/inventoryStore';

describe('StockBars', () => {
  let wrapper;
  let store;

  beforeEach(() => {
    wrapper = mount(StockBars, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              inventory: {
                items: []
              }
            }
          })
        ]
      }
    });
    store = useInventoryStore();
  });

  it('loads inventory on mount', () => {
    expect(store.loadInventory).toHaveBeenCalled();
  });

  it('calculates stock metrics correctly with sample data', async () => {
    // Mock inventory data
    store.items = [
      { quantity: 10 }, // In stock
      { quantity: 5 },  // Low stock
      { quantity: 0 }   // No stock
    ];

    await wrapper.vm.$nextTick();

    // Test computed properties
    expect(wrapper.vm.totalStock).toBe(15);
    expect(wrapper.vm.inStock).toBe(15);
    expect(wrapper.vm.lowStock).toBe(13); // 5 + 8 (lowStockThreshold)
    expect(wrapper.vm.noStock).toBe(0);
  });

  it('displays correct width percentages', async () => {
    store.items = [
      { quantity: 20 }, // In stock
      { quantity: 5 },  // Low stock
      { quantity: 0 }   // No stock
    ];

    await wrapper.vm.$nextTick();

    expect(wrapper.vm.inStockWidth).toBe('100%');
    expect(wrapper.vm.lowStockWidth).toBe('52%'); // (5 + 8) / 25 * 100
    expect(wrapper.vm.noStockWidth).toBe('0%');
  });

  it('shows minimum width when no items', async () => {
    store.items = [];
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.inStockWidth).toBe('10%');
    expect(wrapper.vm.lowStockWidth).toBe('10%');
    expect(wrapper.vm.noStockWidth).toBe('10%');
  });

  it('renders all three stock bars', () => {
    expect(wrapper.find('.bar.green').exists()).toBe(true);
    expect(wrapper.find('.bar.yellow').exists()).toBe(true);
    expect(wrapper.find('.bar.red').exists()).toBe(true);
  });

  it('displays correct legend labels', () => {
    const legends = wrapper.findAll('li');
    expect(legends[0].text()).toBe('In Stocks');
    expect(legends[1].text()).toBe('Low Stocks');
    expect(legends[2].text()).toBe('Out of Stocks');
  });
});
