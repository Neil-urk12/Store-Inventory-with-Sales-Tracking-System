/**
 * @fileoverview Utility functions for filtering items based on search queries and categories.
 * Includes memoization for performance optimization.
 */

/**
 * Filters an array of items based on a search query and category filter.
 *
 * @param {Array<Object>} items - The array of items to filter.  Each item object should have at least a `name` and `categoryId` property.
 * @param {Object} options - Filtering options.
 * @param {string} [options.searchQuery=''] - The search query string.
 * @param {string} [options.categoryFilter=''] - The category filter string (categoryId).
 * @param {function(string): string} [options.getCategoryName=null] - A function to retrieve the category name given a categoryId.  If null, category filtering is disabled.
 * @returns {Array<Object>} A new array containing only the items that match the search query and category filter.
 *
 * @example
 * const items = [
 *   { id: 1, name: 'Item A', categoryId: 'cat1' },
 *   { id: 2, name: 'Item B', categoryId: 'cat2' },
 *   { id: 3, name: 'Item C', categoryId: 'cat1' }
 * ];
 *
 * const filteredItems = filterItems(items, { searchQuery: 'a', categoryFilter: 'cat1' });
 * console.log(filteredItems); // Output: [{ id: 1, name: 'Item A', categoryId: 'cat1' }]
 */
function filterItems(items, { searchQuery = '', categoryFilter = '', getCategoryName = null }) {
  const query = searchQuery ? searchQuery.toLowerCase() : ''

  return items.filter(item => {
    const matchesSearch = !query || [
      item.name,
      item.sku,
      getCategoryName ? getCategoryName(item.categoryId) : ''
    ].some(field => String(field).toLowerCase().includes(query))

    const matchesCategory = !categoryFilter || item.categoryId === categoryFilter

    return matchesSearch && matchesCategory
  })
}

/**
 * Memoizes a function to improve performance by caching results.
 *
 * @param {function} fn - The function to memoize.
 * @returns {function} A memoized version of the function.
 *
 * @example
 * const memoizedAdd = memoize((a, b) => a + b);
 * console.log(memoizedAdd(1, 2)); // Output: 3
 * console.log(memoizedAdd(1, 2)); // Output: 3 (from cache)
 */
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = fn.apply(this, args)
    cache.set(key, result)
    return result
  }
}

/**
 * A memoized version of the `filterItems` function.
 * Uses memoization to cache results and improve performance for repeated calls with the same arguments.
 */
const memoizedFilterItems = memoize(filterItems)

export default memoizedFilterItems
