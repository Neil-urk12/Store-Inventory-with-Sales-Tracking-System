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

const memoizedFilterItems = memoize(filterItems)

export default memoizedFilterItems
