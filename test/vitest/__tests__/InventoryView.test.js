import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import InventoryView from 'src/pages/InventoryView.vue';
import { useInventoryStore } from 'src/stores/inventoryStore';

describe('InventoryView', () => {
  let wrapper;
  let store;

  beforeEach(() => {
    wrapper = mount(InventoryView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
          }),
        ],
        stubs: {
          'InventoryHeaderActions': true,
          'InventoryGridView': true,
          'InventoryListView': true,
          'ItemDialog': true,
          'DeleteDialog': true,
        },
      },
    });
    store = useInventoryStore();
  });

  it('shows loading spinner when loading is true', async () => {
    store.loading = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.q-spinner-dots').exists()).toBe(true);
  });

  it('shows error banner when there is an error', async () => {
    store.error = 'Test error message';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bg-negative').exists()).toBe(true);
    expect(wrapper.text()).toContain('Test error message');
  });

  it('shows grid view when viewMode is grid', async () => {
    store.viewMode = 'grid';
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'InventoryGridView' }).exists()).toBe(true);
  });

  it('shows list view when viewMode is list', async () => {
    store.viewMode = 'list';
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'InventoryListView' }).exists()).toBe(true);
  });

  it('calls initializeDb and loadInventory on mount', () => {
    expect(store.initializeDb).toHaveBeenCalled();
    expect(store.loadInventory).toHaveBeenCalled();
  });
});
