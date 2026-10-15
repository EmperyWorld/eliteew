import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import productsData from '../products.json' with { type: 'json' }
import templateBaseline from '../template-baseline.json' with { type: 'json' }

const templateRootDir = dirname(fileURLToPath(import.meta.url))
const templateUploadsDir = join(templateRootDir, '..', 'template-uploads')
const runtimeUploadsDir = process.env.UPLOADS_DIR || join(templateRootDir, '..', 'uploads')


async function migrateLegacyContentSections() {
  const legacyBlocks = await prisma.contentBlock.findMany({ where: { section: 'aromatherapy' } })
  let migrated = 0
  for (const block of legacyBlocks) {
    const existing = await prisma.contentBlock.findUnique({
      where: { page_section_key: { page: block.page, section: 'value_block', key: block.key } },
    })
    if (existing) continue
    await prisma.contentBlock.update({ where: { id: block.id }, data: { section: 'value_block' } })
    migrated += 1
  }
  if (migrated) console.log('✅ Migrated legacy content sections:', migrated)

  const imageResult = await prisma.contentImage.updateMany({ where: { section: 'aromatherapy' }, data: { section: 'value_block' } })
  if (imageResult.count) console.log('✅ Migrated legacy content images:', imageResult.count)
}

async function seedTemplateUploads() {
  if (!existsSync(templateUploadsDir)) {
    console.log('ℹ️ No template-uploads directory, skipping media seed')
    return
  }
  mkdirSync(runtimeUploadsDir, { recursive: true })
  cpSync(templateUploadsDir, runtimeUploadsDir, { recursive: true })
  console.log('✅ Template upload placeholders copied')
}

type TemplateSiteSettings = {
  contactPhone: string
  contactEmail: string
  contactAddress: string
  workingHours: string
  siteTitle: string
  siteDescription: string
  defaultTheme: string
}

type TemplateConfigEntry = {
  key: string
  type: string
  valueJson: string
}

type TemplateContentBlock = {
  page: string
  section: string
  key: string
  value: string
  maxLength?: number
  hint?: string
}

type TemplateContentImage = {
  page: string
  section: string
  key: string
  url: string
  alt?: string
  width?: number
  height?: number
  hint?: string
}

type TemplateConsultation = {
  slug: string
  title: string
  shortDescription: string
  fullDescription?: string
  price: number
  duration: number
  image?: string
  isPopular?: boolean
  order: number
}

type TemplateMasterclass = {
  slug: string
  title: string
  shortDescription: string
  fullDescription?: string
  price: number
  priceNote?: string
  duration: number
  maxParticipants: number
  minParticipants?: number
  level?: string
  image?: string
  category: string
  order: number
}

type TemplateGalleryImage = {
  url: string
  alt?: string
  title?: string
  category: string
  order: number
  isActive?: boolean
}

type TemplateBaseline = {
  siteSettings: TemplateSiteSettings
  configEntries: TemplateConfigEntry[]
  contentBlocks: TemplateContentBlock[]
  contentImages: TemplateContentImage[]
  consultations: TemplateConsultation[]
  masterclasses: TemplateMasterclass[]
  galleryImages: TemplateGalleryImage[]
}

type TemplateProductRecord = {
  name: string
  collection: string
  volume: string
  price: number
  description: string
  image?: string
  images?: string[]
}

type TemplateProductsData = {
  collectionDescriptions?: Record<string, string>
  products?: TemplateProductRecord[]
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })
const baseline = templateBaseline as TemplateBaseline
const catalog = productsData as TemplateProductsData

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const buildShortDescription = (value: string): string => {
  const normalized = normalizeWhitespace(value)
  const firstSentence = normalized.split(/(?<=[.!?])\s+/u)[0] || normalized
  if (firstSentence.length <= 180) {
    return firstSentence
  }
  return `${normalized.slice(0, 177).trimEnd()}...`
}

const buildProductSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')

const mapProductUploadPath = (value?: string | null): string | null => {
  if (!value) return null
  const normalized = value
    .replace('@assets/', '/uploads/')
    .replace(/\.(png|jpg|jpeg)$/i, '.webp')
  return normalized.replace(/-\d+(?=\.webp$)/, '')
}

const uniqueStrings = (values: Array<string | null | undefined>): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
]

async function seedAdminUser() {
  const adminPassword = process.env.ADMIN_PASSWORD
    ? await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
    : null

  if (!adminPassword) {
    console.error('❌ ADMIN_PASSWORD is not set in environment variables')
    process.exit(1)
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPassword,
      role: 'ADMIN',
      name: 'Администратор',
    },
    create: {
      email: adminEmail,
      passwordHash: adminPassword,
      name: 'Администратор',
      role: 'ADMIN',
    },
  })

  console.log('✅ Admin user synchronized')
}

async function seedSiteSettings() {
  const existing = await prisma.siteSettings.findUnique({ where: { id: 'main' } })
  if (existing) {
    console.log('ℹ️ Site settings already exist, keeping current values')
    return
  }

  await prisma.siteSettings.create({
    data: {
      id: 'main',
      ...baseline.siteSettings,
    },
  })

  console.log('✅ Site settings created')
}

async function seedConfigEntries() {
  const existingEntries = await prisma.config.findMany({
    where: { namespace: 'site' },
    select: { key: true },
  })
  const existingKeys = new Set(existingEntries.map((entry) => entry.key))
  const missingEntries = baseline.configEntries.filter((entry) => !existingKeys.has(entry.key))

  if (!missingEntries.length) {
    console.log('ℹ️ Site config already contains template entries')
    return
  }

  await prisma.config.createMany({
    data: missingEntries.map((entry) => ({
      namespace: 'site',
      key: entry.key,
      type: entry.type,
      valueJson: entry.valueJson as never,
    })),
    skipDuplicates: true,
  })

  console.log('✅ Config entries created:', missingEntries.length)
}

async function seedContentBlocks() {
  if (!baseline.contentBlocks.length) return

  const result = await prisma.contentBlock.createMany({
    data: baseline.contentBlocks.map((block) => ({
      page: block.page,
      section: block.section,
      key: block.key,
      value: block.value,
      type: 'text',
      maxLength: block.maxLength,
      hint: block.hint,
    })),
    skipDuplicates: true,
  })

  console.log('✅ Content blocks created:', result.count)
}

async function seedContentImages() {
  if (!baseline.contentImages.length) return

  const result = await prisma.contentImage.createMany({
    data: baseline.contentImages.map((image) => ({
      page: image.page,
      section: image.section,
      key: image.key,
      url: image.url,
      alt: image.alt,
      width: image.width,
      height: image.height,
      hint: image.hint,
    })),
    skipDuplicates: true,
  })

  console.log('✅ Content images created:', result.count)
}

async function seedConsultations() {
  if (!baseline.consultations.length) return

  const result = await prisma.consultation.createMany({
    data: baseline.consultations,
    skipDuplicates: true,
  })

  console.log('✅ Consultations created:', result.count)
}

async function seedMasterclasses() {
  if (!baseline.masterclasses.length) return

  const result = await prisma.masterclass.createMany({
    data: baseline.masterclasses,
    skipDuplicates: true,
  })

  console.log('✅ Masterclasses created:', result.count)
}

async function seedGalleryImages() {
  if (!baseline.galleryImages.length) return

  const existingCount = await prisma.galleryImage.count()
  if (existingCount > 0) {
    console.log('ℹ️ Gallery already contains images, skipping template gallery seed')
    return
  }

  await prisma.galleryImage.createMany({
    data: baseline.galleryImages.map((image) => ({
      url: image.url,
      alt: image.alt,
      title: image.title,
      category: image.category,
      order: image.order,
      isActive: image.isActive ?? true,
    })),
  })

  console.log('✅ Gallery images created:', baseline.galleryImages.length)
}

async function seedProducts() {
  const collectionDescriptions = catalog.collectionDescriptions || {}
  const products = catalog.products || []
  if (!products.length) {
    console.log('ℹ️ No products found in template catalog')
    return
  }

  const groupedByName = products.reduce<Record<string, TemplateProductRecord[]>>((acc, item) => {
    acc[item.name] = acc[item.name] || []
    acc[item.name].push(item)
    return acc
  }, {})

  const existingProducts = await prisma.product.findMany({ select: { slug: true } })
  const existingSlugs = new Set(existingProducts.map((item) => item.slug))

  let createdCount = 0
  for (const [name, items] of Object.entries(groupedByName)) {
    if (!items.length) continue

    const slug = buildProductSlug(name)
    if (existingSlugs.has(slug)) {
      continue
    }

    const base = items[0]
    const image = mapProductUploadPath(base.image)
    const images = uniqueStrings([
      image,
      ...(base.images || []).map(mapProductUploadPath),
    ])

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        collection: base.collection,
        collectionDescription: collectionDescriptions[base.collection] || null,
        volume: base.volume,
        price: base.price,
        description: normalizeWhitespace(base.description),
        shortDescription: buildShortDescription(base.description),
        image,
        images,
        inStock: true,
        stockQuantity: 10,
        isFeatured: false,
        isNew: false,
        category: 'accessories',
      },
    })

    await prisma.productVariant.createMany({
      data: items.map((variant) => ({
        productId: product.id,
        volume: variant.volume,
        price: variant.price,
        oldPrice: null,
        sku: `${slug}-${variant.volume}`.replace(/\s+/g, '-'),
        stock: 10,
      })),
    })

    createdCount += 1
  }

  console.log('✅ Product groups created:', createdCount)
}

async function main() {
  console.log('🌱 Seeding template baseline...')

  await migrateLegacyContentSections()
  await seedTemplateUploads()
  await seedAdminUser()
  await seedSiteSettings()
  await seedConfigEntries()
  await seedContentBlocks()
  await seedContentImages()
  await seedConsultations()
  await seedMasterclasses()
  await seedGalleryImages()
  await seedProducts()

  console.log('🎉 Template baseline is ready')
}

main()
  .catch((error) => {
    console.error('❌ Template seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
