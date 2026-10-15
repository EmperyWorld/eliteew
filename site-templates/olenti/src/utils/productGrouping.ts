import type { Product, ProductGroup } from '@typings/product'

/**
 * Группирует товары по названию, создавая ProductGroup с вариантами объемов
 * Поддерживает как новую структуру (с variants из API), так и старую (отдельные продукты)
 */
export const groupProductsByName = (products: Product[]): ProductGroup[] => {
  const groupsMap = new Map<string, ProductGroup>()

  products.forEach((product) => {
    const groupId = product.name.toLowerCase().trim()
    
    // Если у продукта уже есть варианты из API - используем их напрямую
    if (product.variants && product.variants.length > 0) {
      const variants: ProductGroup['variants'] = product.variants.map(v => ({
        id: v.id,
        volume: v.volume,
        price: v.price,
        originalPrice: v.oldPrice,
        status: v.stock > 0 ? 'available' as const : 'out-of-stock' as const,
      }))

      // Сортируем варианты по объему
      variants.sort((a, b) => {
        const volumeA = parseFloat(a.volume.replace(/[^\d.]/g, '')) || 0
        const volumeB = parseFloat(b.volume.replace(/[^\d.]/g, '')) || 0
        return volumeA - volumeB
      })

      const prices = variants.map(v => v.price)

      const group: ProductGroup = {
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        collection: product.collection,
        collectionDescription: product.collectionDescription,
        image: product.image,
        images: product.images,
        variants,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        rating: product.rating,
        isNew: product.isNew,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }

      groupsMap.set(groupId, group)
      return
    }

    // Старая логика для обратной совместимости
    if (!groupsMap.has(groupId)) {
      const variants: ProductGroup['variants'] = []
      
      if (product.volume) {
        variants.push({
          id: product.id,
          volume: product.volume,
          price: product.price,
          originalPrice: product.originalPrice,
          status: product.status || (product.inStock ? 'available' : 'out-of-stock'),
        })
      }

      const group: ProductGroup = {
        id: `group-${groupId.replace(/\s+/g, '-')}`,
        name: product.name,
        description: product.description,
        category: product.category,
        collection: product.collection,
        collectionDescription: product.collectionDescription,
        image: product.image,
        images: product.images,
        variants,
        minPrice: product.price,
        maxPrice: product.price,
        rating: product.rating,
        isNew: product.isNew,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }

      groupsMap.set(groupId, group)
    } else {
      const group = groupsMap.get(groupId)!
      
      if (product.volume) {
        group.variants.push({
          id: product.id,
          volume: product.volume,
          price: product.price,
          originalPrice: product.originalPrice,
          status: product.status || (product.inStock ? 'available' : 'out-of-stock'),
        })
      }

      group.minPrice = Math.min(group.minPrice, product.price)
      group.maxPrice = Math.max(group.maxPrice, product.price)

      if (new Date(product.createdAt) < new Date(group.createdAt)) {
        group.createdAt = product.createdAt
      }
      if (new Date(product.updatedAt) > new Date(group.updatedAt)) {
        group.updatedAt = product.updatedAt
      }

      if (product.isNew) {
        group.isNew = true
      }
    }
  })

  // Сортируем варианты по объему
  groupsMap.forEach((group) => {
    group.variants.sort((a, b) => {
      const volumeA = parseFloat(a.volume.replace(/[^\d.]/g, '')) || 0
      const volumeB = parseFloat(b.volume.replace(/[^\d.]/g, '')) || 0
      return volumeA - volumeB
    })
  })

  return Array.from(groupsMap.values())
}

/**
 * Находит ProductGroup по ID или названию
 */
export const findProductGroup = (groups: ProductGroup[], identifier: string): ProductGroup | undefined => {
  return groups.find(
    (group) => group.id === identifier || group.name.toLowerCase().trim() === identifier.toLowerCase().trim()
  )
}

/**
 * Находит конкретный вариант товара по ID группы и объему
 */
export const findProductVariant = (
  group: ProductGroup,
  volume: string
): ProductGroup['variants'][0] | undefined => {
  return group.variants.find((variant) => variant.volume === volume)
}

