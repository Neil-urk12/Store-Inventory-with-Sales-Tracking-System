export function filterItems(items, { searchQuery = '', categoryFilter = '', getCategoryName = null }) {
  const query = searchQuery.toLowerCase();

  return items.filter(item => {
    const matchesSearch = !query || [
      item.name,
      item.sku,
      getCategoryName ? getCategoryName(item.categoryId) : ''
    ].some(field => String(field).toLowerCase().includes(query));

    const matchesCategory = !categoryFilter || item.categoryId === categoryFilter

    return matchesSearch && matchesCategory;
  })
}
