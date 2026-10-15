import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient } from '@services/api/client'
import type { MasterclassAdmin, MasterclassCategory } from '@typings/admin'

const emptyMasterclass: Omit<MasterclassAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  slug: '',
  description: '',
  shortDescription: '',
  price: 0,
  priceNote: '',
  level: 'all',
  maxParticipants: 10,
  minParticipants: undefined,
  duration: 120,
  image: '',
  status: 'draft',
  category: 'workshop',
  order: 0,
}

export const useMasterclassEdit = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [formData, setFormData] = useState(emptyMasterclass)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isNew || !id) {
      return
    }

    let isMounted = true

    apiClient
      .get(`/masterclasses/${id}`)
      .then((response) => {
        if (!isMounted) {
          return
        }

        const data = response.data as {
          id: string
          title: string
          slug: string
          shortDescription: string
          fullDescription: string | null
          price: number
          priceNote: string | null
          duration: number
          maxParticipants: number
          minParticipants: number | null
          level: string | null
          image: string | null
          category: MasterclassCategory
          isActive: boolean
          order: number | null
        }

        setFormData({
          title: data.title,
          slug: data.slug,
          description: data.fullDescription ?? data.shortDescription,
          shortDescription: data.shortDescription,
          price: data.price,
          priceNote: data.priceNote ?? '',
          level: (data.level as MasterclassAdmin['level'] | null) ?? 'all',
          maxParticipants: data.maxParticipants,
          minParticipants: data.minParticipants ?? undefined,
          duration: data.duration,
          image: data.image ?? '',
          status: data.isActive ? 'active' : 'draft',
          category: data.category,
          order: data.order ?? 0,
        })
      })
      .catch((error) => {
        console.error('Failed to load masterclass', error)
      })

    return () => {
      isMounted = false
    }
  }, [id, isNew])

  const handleChange = useCallback((field: keyof typeof formData, value: string | number | boolean | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const generateSlug = useCallback(() => {
    const slug = formData.title
      .toLowerCase()
      .replace(/[а-яё]/g, (char) => {
        const map: Record<string, string> = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
          'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        }
        return map[char] || char
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    handleChange('slug', slug)
  }, [formData.title, handleChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const masterclassData = {
        title: formData.title,
        slug: formData.slug || formData.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-'),
        fullDescription: formData.description,
        shortDescription: formData.shortDescription || formData.description.substring(0, 100),
        price: formData.price,
        priceNote: formData.priceNote || null,
        level: formData.level,
        maxParticipants: formData.maxParticipants,
        minParticipants: formData.minParticipants ?? null,
        duration: formData.duration,
        image: formData.image || null,
        category: formData.category,
        isActive: formData.status === 'active',
        order: formData.order,
      }

      if (isNew) {
        await apiClient.post('/masterclasses', masterclassData)
      } else {
        await apiClient.patch(`/masterclasses/${id}`, masterclassData)
      }

      navigate('/admin/masterclasses')
    } catch (error) {
      console.error('Failed to save masterclass:', error)
      alert('Ошибка сохранения мастер-класса')
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageUpload = async (file: File) => {
      try {
        const formDataUpload = new FormData()
        formDataUpload.append('file', file)
        const response = await apiClient.post('/admin/upload', formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        handleChange('image', response.data.url)
      } catch (error) {
        console.error('Upload failed:', error)
        alert('Ошибка загрузки изображения')
      }
  }

  return {
    isNew,
    formData,
    isSaving,
    handleChange,
    generateSlug,
    handleSubmit,
    handleImageUpload,
    navigate
  }
}
