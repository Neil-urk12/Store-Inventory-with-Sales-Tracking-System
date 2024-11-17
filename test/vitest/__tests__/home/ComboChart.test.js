import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ComboChart from 'src/components/home/ComboChart.vue';
import { Chart } from 'chart.js';

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: vi.fn(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    data: {},
  })),
  registerables: []
}));

describe('ComboChart', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(ComboChart, {
      global: {
        mocks: {
          $q: {
            dark: {
              isActive: false
            }
          }
        }
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with weekly timeframe by default', () => {
    expect(wrapper.vm.selectedTimeframe).toBe('weekly');
  });

  it('creates chart instance on mount', () => {
    expect(Chart).toHaveBeenCalled();
    expect(Chart).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        type: 'bar',
        options: expect.any(Object)
      })
    );
  });

  it('updates chart when timeframe changes', async () => {
    const updateChartSpy = vi.spyOn(wrapper.vm, 'updateChart');
    
    await wrapper.setData({ selectedTimeframe: 'daily' });
    await wrapper.find('select').trigger('change');
    
    expect(updateChartSpy).toHaveBeenCalled();
  });

  it('contains correct data structure for each timeframe', () => {
    // Daily data structure
    expect(wrapper.vm.dailyData).toEqual({
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: expect.arrayContaining([
        expect.objectContaining({
          label: 'Sales',
          type: 'line'
        }),
        expect.objectContaining({
          label: 'Expenses',
          type: 'bar'
        })
      ])
    });

    // Weekly data structure
    expect(wrapper.vm.weeklyData).toEqual({
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: expect.arrayContaining([
        expect.objectContaining({
          label: 'Sales',
          type: 'line'
        }),
        expect.objectContaining({
          label: 'Expenses',
          type: 'bar'
        })
      ])
    });
  });

  it('destroys chart instance before unmount', () => {
    const destroySpy = vi.fn();
    wrapper.vm.comboChart = { destroy: destroySpy };
    
    wrapper.unmount();
    
    expect(destroySpy).toHaveBeenCalled();
  });

  it('renders select element with all timeframe options', () => {
    const options = wrapper.findAll('option');
    const expectedOptions = ['daily', 'weekly', 'monthly', 'yearly'];
    
    expect(options).toHaveLength(4);
    options.forEach((option, index) => {
      expect(option.element.value).toBe(expectedOptions[index]);
    });
  });

  it('applies correct styling based on dark mode', async () => {
    // Test light mode
    expect(wrapper.find('.chart-container').attributes('style'))
      .toContain('color: black');

    // Test dark mode
    await wrapper.setProps({
      $q: {
        dark: {
          isActive: true
        }
      }
    });
    
    expect(wrapper.find('.chart-container').attributes('style'))
      .toContain('color: white');
  });
});