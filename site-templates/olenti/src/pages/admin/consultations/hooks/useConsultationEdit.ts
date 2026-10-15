import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient } from '@services/api/client'
import type { ConsultationAdmin } from '@typings/admin'

const emptyConsultation: Omit<ConsultationAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  slug: '',
  description: '',
  shortDescription: '',
  price: 0,
  duration: 60,
  image: '',
  status: 'draft',
  popular: false,
  order: 0,
}

export const useConsultationEdit = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [formData, setFormData] = useState(emptyConsultation)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew || !id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    apiClient
      .get(`/consultations/${id}`)
      .then((response) => {
        if (!isMounted) {
          return
        }

        const data = response.data as {
          id: string
          title: string
          slug: string
          shortDescription: string | null
          fullDescription: string | null
          price: number
          duration: number
          image: string | null
          isPopular: boolean | null
          isActive: boolean
          order: number | null
        }

        setFormData({
          title: data.title,
          slug: data.slug,
          description: data.fullDescription ?? data.shortDescription ?? '',
          shortDescription: data.shortDescription ?? '',
          price: data.price,
          duration: data.duration,
          image: data.image ?? '',
          status: data.isActive ? 'active' : 'draft',
          popular: Boolean(data.isPopular),
          order: data.order ?? 0,
        })
        setIsLoading(false)
      })
      .catch((error) => {
        console.error('Failed to load consultation', error)
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [id, isNew])

  const handleChange = useCallback((field: keyof typeof formData, value: string | number | boolean) => {
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
      const consultationData = {
        title: formData.title,
        slug: formData.slug || formData.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-'),
        fullDescription: formData.description,
        shortDescription: formData.shortDescription || formData.description.substring(0, 100),
        price: formData.price,
        duration: formData.duration,
        image: formData.image || null,
        isPopular: formData.popular,
        isActive: formData.status === 'active',
        order: formData.order,
      }

      if (isNew) {
        await apiClient.post('/consultations', consultationData)
      } else {
        await apiClient.patch(`/consultations/${id}`, consultationData)
      }

      navigate('/admin/consultations')
    } catch (error) {
      console.error('Failed to save consultation:', error)
      alert('Ошибка сохранения консультации')
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
    isLoading,
    handleChange,
    generateSlug,
    handleSubmit,
    handleImageUpload,
    navigate
  }
}
