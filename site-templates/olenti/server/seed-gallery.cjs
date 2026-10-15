const { prisma } = require('./db.cjs')

// Auto-generated from template-baseline.json
const galleryImages = [
  {
    url: "/uploads/gallery/brand-1.webp",
    alt: "Пример работы бренда",
    title: "Кейс 1",
    category: "brand",
    order: 1,
  },
  {
    url: "/uploads/gallery/workshop-1.webp",
    alt: "Групповой формат",
    title: "Воркшоп",
    category: "workshop",
    order: 2,
  },
  {
    url: "/uploads/gallery/products-1.webp",
    alt: "Каталог",
    title: "Каталог",
    category: "products",
    order: 3,
  },
]

module.exports = { galleryImages }

