import { Response, Router } from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import sharp from 'sharp'
import { prisma } from '../index.js'
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth.js'
import { asString } from '../utils/params.js'


const LEGACY_CONTENT_SECTION_ALIASES: Record<string, string> = {
  aromatherapy: 'value_block',
}

function applyLegacySectionAliases(
  content: Record<string, Record<string, Record<string, string>>>,
) {
  for (const pageBlocks of Object.values(content)) {
    for (const [legacy, canonical] of Object.entries(LEGACY_CONTENT_SECTION_ALIASES)) {
      if (pageBlocks[legacy] && !pageBlocks[canonical]) {
        pageBlocks[canonical] = pageBlocks[legacy]
      }
    }
  }
}

const router = Router()

// Configure multer for image uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only images allowed'))
    }
  }
})

// ==================== CONTENT BLOCKS ====================

// Get all content blocks (public)
router.get('/blocks', async (req, res: Response) => {
  try {
    const page = asString(req.query.page)

    const where = page ? { page: page as string } : {}
    const blocks = await prisma.contentBlock.findMany({ where })

    // Transform to key-value format for easy frontend use
    const content: Record<string, Record<string, Record<string, string>>> = {}
    blocks.forEach(block => {
      if (!content[block.page]) content[block.page] = {}
      if (!content[block.page][block.section]) content[block.page][block.section] = {}
      content[block.page][block.section][block.key] = block.value
    })

    applyLegacySectionAliases(content)

    res.json({ data: blocks, content })
  } catch (error) {
    console.error('Get content blocks error:', error)
    res.status(500).json({ error: 'Failed to get content blocks' })
  }
})

// Get content blocks for admin (with metadata)
router.get('/blocks/admin', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    const blocks = await prisma.contentBlock.findMany({
      orderBy: [{ page: 'asc' }, { section: 'asc' }, { key: 'asc' }]
    })
    res.json({ data: blocks })
  } catch (error) {
    console.error('Get admin content blocks error:', error)
    res.status(500).json({ error: 'Failed to get content blocks' })
  }
})

// Upsert content block (admin)
router.put('/blocks', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { page, section, key, value, type, maxLength, hint } = req.body

    if (!page || !section || !key) {
      return res.status(400).json({ error: 'page, section, key are required' })
    }

    const block = await prisma.contentBlock.upsert({
      where: { page_section_key: { page, section, key } },
      update: { value, type, maxLength, hint },
      create: { page, section, key, value, type, maxLength, hint }
    })

    res.json({ data: block })
  } catch (error) {
    console.error('Upsert content block error:', error)
    res.status(500).json({ error: 'Failed to save content block' })
  }
})

// Bulk upsert content blocks (admin)
router.put('/blocks/bulk', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { blocks } = req.body

    if (!Array.isArray(blocks)) {
      return res.status(400).json({ error: 'blocks array is required' })
    }

    const results = await Promise.all(
      blocks.map(({ page, section, key, value, type, maxLength, hint }) =>
        prisma.contentBlock.upsert({
          where: { page_section_key: { page, section, key } },
          update: { value, type, maxLength, hint },
          create: { page, section, key, value, type: type || 'text', maxLength, hint }
        })
      )
    )

    res.json({ data: results })
  } catch (error) {
    console.error('Bulk upsert content blocks error:', error)
    res.status(500).json({ error: 'Failed to save content blocks' })
  }
})

// Delete content block (admin)
router.delete('/blocks/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.contentBlock.delete({ where: { id: asString(req.params.id) } })
    res.json({ success: true })
  } catch (error) {
    console.error('Delete content block error:', error)
    res.status(500).json({ error: 'Failed to delete content block' })
  }
})

// ==================== CONTENT IMAGES ====================

// Get all content images (public)
router.get('/images', async (req, res: Response) => {
  try {
    const page = asString(req.query.page)

    const where = page ? { page: page as string } : {}
    const images = await prisma.contentImage.findMany({ where })

    // Transform to key-value format
    const content: Record<string, Record<string, Record<string, string>>> = {}
    images.forEach(img => {
      if (!content[img.page]) content[img.page] = {}
      if (!content[img.page][img.section]) content[img.page][img.section] = {}
      content[img.page][img.section][img.key] = img.url
    })

    res.json({ data: images, content })
  } catch (error) {
    console.error('Get content images error:', error)
    res.status(500).json({ error: 'Failed to get content images' })
  }
})

// Get content images for admin (with metadata)
router.get('/images/admin', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    const images = await prisma.contentImage.findMany({
      orderBy: [{ page: 'asc' }, { section: 'asc' }, { key: 'asc' }]
    })
    res.json({ data: images })
  } catch (error) {
    console.error('Get admin content images error:', error)
    res.status(500).json({ error: 'Failed to get content images' })
  }
})

// Upload and upsert content image (admin)
router.post('/images/upload', authenticate, requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, section, key, alt, hint } = req.body

    if (!page || !section || !key) {
      return res.status(400).json({ error: 'page, section, key are required' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' })
    }

    const uploadsBase = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
    const uploadDir = path.join(uploadsBase, 'content')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Process image with sharp
    const filename = `${page}-${section}-${key}-${Date.now()}.webp`
    const filepath = path.join(uploadDir, filename)

    const metadata = await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .toFile(filepath)

    const url = `/uploads/content/${filename}`

    // Upsert in database
    const image = await prisma.contentImage.upsert({
      where: { page_section_key: { page, section, key } },
      update: { url, alt, width: metadata.width, height: metadata.height, hint },
      create: { page, section, key, url, alt, width: metadata.width, height: metadata.height, hint }
    })

    res.json({ data: image })
  } catch (error) {
    console.error('Upload content image error:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// Update content image metadata (admin)
router.put('/images/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { alt, hint } = req.body

    const image = await prisma.contentImage.update({
      where: { id: asString(req.params.id) },
      data: { alt, hint }
    })

    res.json({ data: image })
  } catch (error) {
    console.error('Update content image error:', error)
    res.status(500).json({ error: 'Failed to update image' })
  }
})

// Delete content image (admin)
router.delete('/images/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const image = await prisma.contentImage.findUnique({ where: { id: asString(req.params.id) } })

    if (image?.url.startsWith('/uploads/')) {
      const uploadsBase = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
      const filepath = path.join(uploadsBase, image.url.replace('/uploads/', ''))
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
      }
    }

    await prisma.contentImage.delete({ where: { id: asString(req.params.id) } })
    res.json({ success: true })
  } catch (error) {
    console.error('Delete content image error:', error)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

// ==================== CONTENT STRUCTURE (for admin UI) ====================

// Get available content structure (pages, sections, keys)
router.get('/structure', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    // Define the content structure with hints and limits
    const structure = {
      pages: [
        {
          id: 'layout',
          name: 'Шапка и общие элементы',
          sections: [
            {
              id: 'header',
              name: 'Шапка сайта',
              blocks: [{ key: 'tagline', name: 'Подзаголовок под названием бренда', maxLength: 80 }],
              images: [],
            },
          ],
        },
        {
          id: 'home',
          name: 'Главная',
          sections: [
            {
              id: 'hero',
              name: 'Hero секция',
              blocks: [
                { key: 'badge', name: 'Бейдж (под заголовком)', maxLength: 60 },
                { key: 'headline_1', name: 'Заголовок, строка 1', maxLength: 40 },
                { key: 'headline_2', name: 'Заголовок, строка 2', maxLength: 60 },
                { key: 'lead', name: 'Подзаголовок (абзац)', maxLength: 400 },
                { key: 'cta_shop', name: 'Кнопка «Магазин»', maxLength: 40 },
                { key: 'cta_consultation', name: 'Кнопка «Консультация»', maxLength: 40 },
                { key: 'card_label', name: 'Карточка справа: подпись', maxLength: 40 },
                { key: 'card_title', name: 'Карточка справа: заголовок', maxLength: 60 },
                { key: 'card_description', name: 'Карточка справа: описание', maxLength: 300 },
                { key: 'card_notes', name: 'Ноты (через запятую)', maxLength: 80, hint: 'Напр.: Бергамот, Лаванда, Белый кедр' },
                { key: 'card_footer', name: 'Карточка: подпись внизу', maxLength: 200 },
                { key: 'badge_small_label', name: 'Маленький бейдж: подпись', maxLength: 30 },
                { key: 'badge_small_text', name: 'Маленький бейдж: текст', maxLength: 30 },
              ],
              images: [
                { key: 'background', name: 'Фон', hint: '1920x1080, ландшафтная ориентация' },
              ]
            },
            {
              id: 'about_preview',
              name: 'Превью «О нас» (блок с фото)',
              blocks: [
                { key: 'greeting', name: 'Приветствие', maxLength: 60 },
                { key: 'title', name: 'Заголовок (имя)', maxLength: 60 },
                { key: 'description_1', name: 'Описание, абзац 1', maxLength: 500 },
                { key: 'description_2', name: 'Описание, абзац 2', maxLength: 500 },
                { key: 'cta_consultation', name: 'Кнопка «Консультация»', maxLength: 40 },
                { key: 'cta_shop', name: 'Кнопка «Коллекция»', maxLength: 40 },
              ],
              images: [
                { key: 'portrait', name: 'Портрет', hint: '1545×2317, вертикальный формат (вертикальный портрет для блока о бренде)' },
              ]
            },
            {
              id: 'why_choose',
              name: 'Почему выбирают нас',
              blocks: [
                { key: 'section_title', name: 'Заголовок секции', maxLength: 80 },
                { key: 'section_subtitle', name: 'Подзаголовок', maxLength: 300 },
                { key: 'item1_title', name: 'Карточка 1: заголовок', maxLength: 60 },
                { key: 'item1_description', name: 'Карточка 1: описание', maxLength: 250 },
                { key: 'item2_title', name: 'Карточка 2: заголовок', maxLength: 60 },
                { key: 'item2_description', name: 'Карточка 2: описание', maxLength: 250 },
                { key: 'item3_title', name: 'Карточка 3: заголовок', maxLength: 60 },
                { key: 'item3_description', name: 'Карточка 3: описание', maxLength: 250 },
                { key: 'item4_title', name: 'Карточка 4: заголовок', maxLength: 60 },
                { key: 'item4_description', name: 'Карточка 4: описание', maxLength: 250 },
              ],
              images: []
            },
            {
              id: 'ways_to_work',
              name: 'Форматы работы',
              blocks: [
                { key: 'badge', name: 'Бейдж над заголовком', maxLength: 60 },
                { key: 'title', name: 'Заголовок секции', maxLength: 80 },
                { key: 'intro', name: 'Вводный абзац', maxLength: 400 },
                { key: 'item1_title', name: 'Формат 1: заголовок', maxLength: 60 },
                { key: 'item1_description', name: 'Формат 1: описание', maxLength: 200 },
                { key: 'item2_title', name: 'Формат 2: заголовок', maxLength: 60 },
                { key: 'item2_description', name: 'Формат 2: описание', maxLength: 200 },
                { key: 'item3_title', name: 'Формат 3: заголовок', maxLength: 60 },
                { key: 'item3_description', name: 'Формат 3: описание', maxLength: 200 },
                { key: 'item4_title', name: 'Формат 4: заголовок', maxLength: 60 },
                { key: 'item4_description', name: 'Формат 4: описание', maxLength: 200 },
              ],
              images: []
            },
            {
              id: 'value_block',
              name: 'Блок ценности',
              blocks: [
                { key: 'badge', name: 'Бейдж', maxLength: 60 },
                { key: 'paragraph_1', name: 'Абзац 1', maxLength: 300 },
                { key: 'paragraph_2', name: 'Абзац 2', maxLength: 300 },
                { key: 'paragraph_3', name: 'Абзац 3', maxLength: 300 },
                { key: 'cta', name: 'Текст кнопки', maxLength: 40 },
              ],
              images: []
            },
            {
              id: 'products_section',
              name: 'Секция «Рекомендуемые товары»',
              blocks: [
                { key: 'badge', name: 'Бейдж над заголовком', maxLength: 60 },
                { key: 'headline_1', name: 'Заголовок, строка 1', maxLength: 40 },
                { key: 'headline_2', name: 'Заголовок, строка 2', maxLength: 40 },
                { key: 'subtitle', name: 'Подзаголовок', maxLength: 200 },
              ],
              images: []
            },
          ]
        },
        {
          id: 'about',
          name: 'О нас',
          sections: [
            {
              id: 'hero',
              name: 'Hero секция',
              blocks: [
                { key: 'badge', name: 'Бейдж', maxLength: 30 },
                { key: 'title', name: 'Заголовок', maxLength: 100 },
                { key: 'description', name: 'Описание', maxLength: 400 },
                { key: 'image_caption', name: 'Подпись на фото ателье', maxLength: 80 },
              ],
              images: [
                { key: 'atelier', name: 'Фото ателье', hint: '1200x800' },
              ]
            },
            {
              id: 'philosophy',
              name: 'Философия',
              blocks: [
                { key: 'title', name: 'Заголовок', maxLength: 60 },
                { key: 'description', name: 'Описание', maxLength: 300 },
                { key: 'value1_title', name: 'Ценность 1: заголовок', maxLength: 60 },
                { key: 'value1_description', name: 'Ценность 1: описание', maxLength: 200 },
                { key: 'value2_title', name: 'Ценность 2: заголовок', maxLength: 60 },
                { key: 'value2_description', name: 'Ценность 2: описание', maxLength: 200 },
                { key: 'value3_title', name: 'Ценность 3: заголовок', maxLength: 60 },
                { key: 'value3_description', name: 'Ценность 3: описание', maxLength: 200 },
              ],
              images: [
                { key: 'ingredients', name: 'Ингредиенты', hint: '1200x800' },
              ]
            },
            {
              id: 'process',
              name: 'Процесс (этапы)',
              blocks: [
                { key: 'title', name: 'Заголовок', maxLength: 60 },
                { key: 'description', name: 'Описание', maxLength: 300 },
                { key: 'archive_note', name: 'Блок «Архив студии»', maxLength: 300 },
                { key: 'step1_title', name: 'Этап 1: заголовок', maxLength: 60 },
                { key: 'step1_description', name: 'Этап 1: описание', maxLength: 200 },
                { key: 'step2_title', name: 'Этап 2: заголовок', maxLength: 60 },
                { key: 'step2_description', name: 'Этап 2: описание', maxLength: 200 },
                { key: 'step3_title', name: 'Этап 3: заголовок', maxLength: 60 },
                { key: 'step3_description', name: 'Этап 3: описание', maxLength: 200 },
                { key: 'step4_title', name: 'Этап 4: заголовок', maxLength: 60 },
                { key: 'step4_description', name: 'Этап 4: описание', maxLength: 200 },
              ],
              images: [
                { key: 'crafting', name: 'Процесс создания', hint: '1200x800' },
              ]
            },
            {
              id: 'timeline',
              name: 'История студии (таймлайн)',
              blocks: [
                { key: 'title', name: 'Заголовок', maxLength: 60 },
                { key: 'intro', name: 'Вводный абзац', maxLength: 400 },
                { key: 'item1_year', name: 'Год 1', maxLength: 10 },
                { key: 'item1_title', name: 'Событие 1: заголовок', maxLength: 60 },
                { key: 'item1_description', name: 'Событие 1: описание', maxLength: 250 },
                { key: 'item2_year', name: 'Год 2', maxLength: 10 },
                { key: 'item2_title', name: 'Событие 2: заголовок', maxLength: 60 },
                { key: 'item2_description', name: 'Событие 2: описание', maxLength: 250 },
                { key: 'item3_year', name: 'Год 3', maxLength: 10 },
                { key: 'item3_title', name: 'Событие 3: заголовок', maxLength: 60 },
                { key: 'item3_description', name: 'Событие 3: описание', maxLength: 250 },
                { key: 'item4_year', name: 'Год 4', maxLength: 10 },
                { key: 'item4_title', name: 'Событие 4: заголовок', maxLength: 60 },
                { key: 'item4_description', name: 'Событие 4: описание', maxLength: 250 },
              ],
              images: []
            },
            {
              id: 'founder',
              name: 'Основатель',
              blocks: [
                { key: 'name', name: 'Имя', maxLength: 50 },
                { key: 'title', name: 'Должность', maxLength: 80 },
                { key: 'bio', name: 'Биография', maxLength: 500 },
                { key: 'bullet1', name: 'Тезис 1', maxLength: 150 },
                { key: 'bullet2', name: 'Тезис 2', maxLength: 150 },
                { key: 'bullet3', name: 'Тезис 3', maxLength: 150 },
                { key: 'cta_button', name: 'Текст кнопки', maxLength: 40 },
              ],
              images: [
                { key: 'portrait', name: 'Портрет', hint: '1545×2317, вертикальный формат (вертикальный портрет для блока о бренде)' },
              ]
            },
            {
              id: 'stats',
              name: 'Статистика',
              blocks: [
                { key: 'stat1_value', name: 'Значение 1', maxLength: 10 },
                { key: 'stat1_label', name: 'Подпись 1', maxLength: 50 },
                { key: 'stat2_value', name: 'Значение 2', maxLength: 10 },
                { key: 'stat2_label', name: 'Подпись 2', maxLength: 50 },
                { key: 'stat3_value', name: 'Значение 3', maxLength: 10 },
                { key: 'stat3_label', name: 'Подпись 3', maxLength: 50 },
              ],
              images: []
            },
            {
              id: 'cta_section',
              name: 'Блок призыва внизу страницы',
              blocks: [
                { key: 'title', name: 'Заголовок', maxLength: 100 },
                { key: 'description', name: 'Описание', maxLength: 300 },
                { key: 'button_consultation', name: 'Кнопка «Консультация»', maxLength: 40 },
                { key: 'button_shop', name: 'Кнопка «Коллекции»', maxLength: 40 },
              ],
              images: []
            },
          ]
        },
        {
          id: 'shop',
          name: 'Магазин',
          sections: [
            {
              id: 'hero',
              name: 'Hero секция',
              blocks: [
                { key: 'badge', name: 'Бейдж над заголовком', maxLength: 60 },
                { key: 'title', name: 'Заголовок', maxLength: 60 },
                { key: 'description', name: 'Описание', maxLength: 200 },
              ],
              images: []
            },
          ]
        },
        {
          id: 'consultations',
          name: 'Консультации',
          sections: [
            {
              id: 'hero',
              name: 'Hero секция',
              blocks: [
                { key: 'title', name: 'Заголовок', maxLength: 60 },
                { key: 'description', name: 'Описание', maxLength: 300 },
              ],
              images: []
            },
          ]
        },
        {
          id: 'masterclasses',
          name: 'Мастер-классы',
          sections: [
            {
              id: 'hero',
              name: 'Hero секция',
              blocks: [
                { key: 'title', name: 'Заголовок', maxLength: 60 },
                { key: 'description', name: 'Описание', maxLength: 300 },
              ],
              images: []
            },
          ]
        },
      ]
    }

    res.json(structure)
  } catch (error) {
    console.error('Get content structure error:', error)
    res.status(500).json({ error: 'Failed to get content structure' })
  }
})

export default router
