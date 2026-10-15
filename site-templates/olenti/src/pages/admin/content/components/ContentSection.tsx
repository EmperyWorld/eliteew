import { ChevronDown, ChevronRight, FileText, Image } from 'lucide-react'
import React from 'react'
import { ContentSectionBlocks } from './ContentSectionBlocks'
import { ContentSectionImages } from './ContentSectionImages'

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

interface ContentSectionProps {
  pageId: string
  section: SectionDef
  isExpanded: boolean
  onToggle: () => void
  getBlockValue: (page: string, section: string, key: string) => string
  onBlockChange: (page: string, section: string, key: string, value: string) => void
  uploading: string | null
  getImageUrl: (page: string, section: string, key: string) => string
  onImageUpload: (page: string, section: string, key: string, file: File) => void
  onImageDelete: (page: string, section: string, key: string) => void
  whereOnSite?: string
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  pageId,
  section,
  isExpanded,
  onToggle,
  getBlockValue,
  onBlockChange,
  uploading,
  getImageUrl,
  onImageUpload,
  onImageDelete,
  whereOnSite
}) => {
  return (
    <div className="border-0">
      {/* Section Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 hover:bg-neutral-50 dark:hover:bg-slate-800/80 transition-all duration-200 group text-left"
        aria-expanded={isExpanded}
        aria-label={`Секция: ${section.name}`}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors shrink-0">
            {isExpanded ? (
              <ChevronDown size={16} className="text-amber-600 dark:text-amber-400" />
            ) : (
              <ChevronRight size={16} className="text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-neutral-900 dark:text-white block">
              {section.name}
            </span>
            {whereOnSite && (
              <span className="text-xs text-neutral-500 dark:text-slate-400 block mt-0.5 sm:mt-1">
                Где на сайте: {whereOnSite}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-9 sm:pl-0">
          {section.blocks.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
              <FileText size={12} />
              {section.blocks.length} текстов
            </span>
          )}
          {section.images.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-medium">
              <Image size={12} />
              {section.images.length} фото
            </span>
          )}
        </div>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 space-y-6 bg-neutral-50/50 dark:bg-slate-900/30 border-t border-neutral-200 dark:border-slate-700">
          <ContentSectionBlocks
            pageId={pageId}
            section={section}
            getBlockValue={getBlockValue}
            onBlockChange={onBlockChange}
          />
          <ContentSectionImages
            pageId={pageId}
            section={section}
            uploading={uploading}
            getImageUrl={getImageUrl}
            onImageUpload={onImageUpload}
            onImageDelete={onImageDelete}
          />
        </div>
      )}
    </div>
  )
}
