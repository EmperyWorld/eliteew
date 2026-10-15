import { apiClient } from '@services/api/client'
import { useCallback, useEffect, useState } from 'react'
import { contentSectionCandidates } from '@utils/contentSectionAliases'

export type PageContentMap = Record<string, Record<string, Record<string, string>>>

export type PageContentStatus = 'loading' | 'ready' | 'error'

interface UsePageContentOptions {
  includeImages?: boolean
}

interface UsePageContentResult {
  contentBlocks: PageContentMap | null
  contentImages: PageContentMap | null
  contentStatus: PageContentStatus
  /** True when CMS blocks were fetched successfully (may be empty object). */
  isContentReady: boolean
  isContentError: boolean
  reload: () => void
  getBlock: (section: string, key: string, fallbackWhenReady: string) => string
  getImage: (section: string, key: string, fallbackWhenReady: string) => string
}

export const usePageContent = (page: string, options: UsePageContentOptions = {}): UsePageContentResult => {
  const includeImages = options.includeImages ?? false
  const [contentBlocks, setContentBlocks] = useState<PageContentMap | null>(null)
  const [contentImages, setContentImages] = useState<PageContentMap | null>(null)
  const [contentStatus, setContentStatus] = useState<PageContentStatus>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setContentStatus('loading')

    const load = async () => {
      try {
        const [blocksRes, imagesRes] = await Promise.all([
          apiClient.get<{ content: PageContentMap }>('/content/blocks', { params: { page } }),
          includeImages
            ? apiClient.get<{ content: PageContentMap }>('/content/images', { params: { page } })
            : Promise.resolve(null),
        ])

        if (cancelled) {
          return
        }

        setContentBlocks(blocksRes.data.content ?? {})
        setContentImages(imagesRes?.data.content ?? null)
        setContentStatus('ready')
      } catch (error) {
        if (!cancelled) {
          console.error(`Failed to load content for ${page} page:`, error)
          setContentBlocks(null)
          setContentImages(null)
          setContentStatus('error')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [includeImages, page, reloadToken])

  const getBlock = useCallback(
    (section: string, key: string, fallbackWhenReady: string): string => {
      if (contentStatus !== 'ready' || !contentBlocks) {
        return ''
      }
      for (const candidate of contentSectionCandidates(section)) {
        const value = contentBlocks[page]?.[candidate]?.[key]
        if (value != null && value !== '') return value
      }
      return fallbackWhenReady
    },
    [contentBlocks, contentStatus, page]
  )

  const getImage = useCallback(
    (section: string, key: string, fallbackWhenReady: string): string => {
      if (contentStatus !== 'ready') {
        return ''
      }
      if (!includeImages || !contentImages) {
        return fallbackWhenReady
      }
      let fromApi: string | undefined
      for (const candidate of contentSectionCandidates(section)) {
        fromApi = contentImages[page]?.[candidate]?.[key]
        if (fromApi?.trim()) break
      }
      return fromApi?.trim() ? fromApi : fallbackWhenReady
    },
    [contentImages, contentStatus, includeImages, page]
  )

  return {
    contentBlocks,
    contentImages,
    contentStatus,
    isContentReady: contentStatus === 'ready',
    isContentError: contentStatus === 'error',
    reload,
    getBlock,
    getImage,
  }
}
