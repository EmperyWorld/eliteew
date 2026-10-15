import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { apiClient } from '@services/api/client'
import { AlertCircle, BookOpen, Check, FileText, Home, Loader2, Save, Sparkles, Store, Users } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { ContentSection } from './components/ContentSection'
import { getWhereOnSite } from './contentHints'
import { contentSectionCandidates } from '@utils/contentSectionAliases'

interface ContentBlock {
  id: string
  page: string
  section: string
  key: string
  value: string
  type: string
  maxLength?: number
  hint?: string
}

interface ContentImage {
  id: string
  page: string
  section: string
  key: string
  url: string
  alt?: string
  hint?: string
}

interface BlockDef {
  key: string
  name: string
  maxLength?: number
  hint?: string
}

interface ImageDef {
  key: string
  name: string
  hint?: string
}

interface SectionDef {
  id: string
  name: string
  blocks: BlockDef[]
  images: ImageDef[]
}

interface PageDef {
  id: string
  name: string
  sections: SectionDef[]
}

interface ContentStructure {
  pages: PageDef[]
}

export const ContentPage: React.FC = () => {
  const [structure, setStructure] = useState<ContentStructure | null>(null)
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [images, setImages] = useState<ContentImage[]>([])
  const [selectedPageId, setSelectedPageId] = useState<string>('home')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
    'home-hero', 'home-about_preview', 'home-why_choose', 'home-ways_to_work', 'home-value_block', 'home-products_section',
    'about-hero', 'about-philosophy', 'about-process', 'about-timeline', 'about-founder', 'about-stats', 'about-cta_section'
  ]))
  const [editedBlocks, setEditedBlocks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [structureRes, blocksRes, imagesRes] = await Promise.all([
        apiClient.get('/content/structure'),
        apiClient.get('/content/blocks/admin'),
        apiClient.get('/content/images/admin')
      ])
      setStructure(structureRes.data)
      setBlocks(blocksRes.data.data || [])
      setImages(imagesRes.data.data || [])
    } catch (error) {
      console.error('Failed to load content:', error)
    }
  }

  const getBlockValue = (page: string, section: string, key: string): string => {
    const editKey = `${page}-${section}-${key}`
    if (editedBlocks[editKey] !== undefined) {
      return editedBlocks[editKey]
    }
    const block = blocks.find(
      b => b.page === page && contentSectionCandidates(section).includes(b.section) && b.key === key
    )
    return block?.value || ''
  }

  const setBlockValue = (page: string, section: string, key: string, value: string) => {
    const editKey = `${page}-${section}-${key}`
    setEditedBlocks(prev => ({ ...prev, [editKey]: value }))
    setSaved(false)
  }

  const getImageUrl = (page: string, section: string, key: string): string => {
    const image = images.find(
      i => i.page === page && contentSectionCandidates(section).includes(i.section) && i.key === key
    )
    return image?.url || ''
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const blocksToSave = Object.entries(editedBlocks).map(([editKey, value]) => {
        const idx1 = editKey.indexOf('-')
        const idx2 = editKey.indexOf('-', idx1 + 1)
        const page = idx1 > 0 ? editKey.slice(0, idx1) : editKey
        const section = idx2 > idx1 ? editKey.slice(idx1 + 1, idx2) : ''
        const key = idx2 > idx1 ? editKey.slice(idx2 + 1) : editKey
        return { page, section, key, value }
      })

      if (blocksToSave.length > 0) {
        await apiClient.put('/content/blocks/bulk', { blocks: blocksToSave })
      }

      setSaved(true)
      setEditedBlocks({})
      await loadData()

      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (
    page: string,
    section: string,
    key: string,
    file: File
  ) => {
    const uploadKey = `${page}-${section}-${key}`
    setUploading(uploadKey)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('page', page)
      formData.append('section', section)
      formData.append('key', key)

      await apiClient.post('/content/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      await loadData()
    } catch (error) {
      console.error('Failed to upload:', error)
      alert('Ошибка загрузки изображения')
    } finally {
      setUploading(null)
    }
  }

  const handleImageDelete = async (
    page: string,
    section: string,
    key: string
  ) => {
    const image = images.find(
      i => i.page === page && contentSectionCandidates(section).includes(i.section) && i.key === key
    )
    if (!image) {
      console.error('Image not found for deletion')
      return
    }

    if (!confirm('Вы уверены, что хотите удалить это изображение?')) {
      return
    }

    try {
      await apiClient.delete(`/content/images/${image.id}`)
      await loadData()
    } catch (error) {
      console.error('Failed to delete image:', error)
      alert('Ошибка удаления изображения')
    }
  }

  const hasUnsavedChanges = Object.keys(editedBlocks).length > 0

  if (!structure) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        </div>
        <p className="text-neutral-500 dark:text-slate-400 text-sm">Загрузка контента...</p>
      </div>
    )
  }

  const selectedPage = structure.pages.find(p => p.id === selectedPageId) ?? structure.pages[0]
  const pageIcons: Record<string, React.ReactNode> = {
    home: <Home size={18} />,
    about: <Users size={18} />,
    shop: <Store size={18} />,
    consultations: <BookOpen size={18} />,
    masterclasses: <BookOpen size={18} />,
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 -mt-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-neutral-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300 mb-2">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="uppercase tracking-[0.18em]">Контент сайта</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/20 rounded-xl">
                <FileText className="text-amber-600 dark:text-amber-400" size={24} />
              </div>
              Управление контентом
              <Sparkles size={16} className="text-amber-400" />
            </h1>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1">
              Выберите страницу и секцию — редактируйте тексты и изображения
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {saved && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <Check size={16} />
                Сохранено
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm font-medium px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertCircle size={16} />
                Есть несохранённые изменения
              </span>
            )}
            <Button
              onClick={handleSaveAll}
              disabled={!hasUnsavedChanges || saving}
              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Сохранить всё
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Page Tabs */}
        <div className="flex flex-wrap gap-2 mt-4 border-t border-neutral-200 dark:border-slate-700 pt-4">
          {structure.pages.map((page) => {
            const isSelected = selectedPageId === page.id
            const blocksCount = page.sections.reduce((sum, s) => sum + s.blocks.length, 0)
            const imagesCount = page.sections.reduce((sum, s) => sum + s.images.length, 0)
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => setSelectedPageId(page.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                    : 'bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-slate-300 hover:bg-neutral-200 dark:hover:bg-slate-600'
                }`}
                aria-pressed={isSelected}
                aria-label={`Страница: ${page.name}`}
              >
                {pageIcons[page.id] ?? <FileText size={16} />}
                <span>{page.name}</span>
                <span className={`text-xs opacity-80 ${isSelected ? 'text-amber-100' : 'text-neutral-500 dark:text-slate-400'}`}>
                  {page.sections.length} секций · {blocksCount} текстов · {imagesCount} фото
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Page: Section List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-slate-400">
          <span>Страница:</span>
          <span className="font-semibold text-neutral-800 dark:text-slate-200">{selectedPage.name}</span>
        </div>

        <div className="space-y-3">
          {selectedPage.sections.map((section) => {
            const sectionKey = `${selectedPage.id}-${section.id}`
            const isExpanded = expandedSections.has(sectionKey)
            const whereOnSite = getWhereOnSite(selectedPage.id, section.id)

            return (
              <Card
                key={section.id}
                className="overflow-hidden border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <ContentSection
                  pageId={selectedPage.id}
                  section={section}
                  isExpanded={isExpanded}
                  onToggle={() => toggleSection(sectionKey)}
                  getBlockValue={getBlockValue}
                  onBlockChange={setBlockValue}
                  uploading={uploading}
                  getImageUrl={getImageUrl}
                  onImageUpload={handleImageUpload}
                  onImageDelete={handleImageDelete}
                  whereOnSite={whereOnSite}
                />
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
