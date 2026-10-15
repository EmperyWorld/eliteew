import { Button } from '@components/atoms/Button'
import { useAdminStore } from '@store/slices/adminSlice'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import { Save } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { ContactSettings } from './components/ContactSettings'
import { PasswordSettings } from './components/PasswordSettings'

export const SettingsPage: React.FC = () => {
  const { changePassword } = useAdminStore()
  const siteSettings = useSiteSettingsStore((state) => state.siteSettings)
  const updateSiteSettings = useSiteSettingsStore((state) => state.updateSiteSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const [formData, setFormData] = useState({
    contactPhone: siteSettings?.contactPhone || '',
    contactEmail: siteSettings?.contactEmail || '',
    contactAddress: siteSettings?.contactAddress || '',
    workingHours: siteSettings?.workingHours || '',
  })

  const handleContactChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    setFormData({
      contactPhone: siteSettings?.contactPhone || '',
      contactEmail: siteSettings?.contactEmail || '',
      contactAddress: siteSettings?.contactAddress || '',
      workingHours: siteSettings?.workingHours || '',
    })
  }, [siteSettings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSuccessMessage('')

    try {
      await updateSiteSettings(formData)
      setSuccessMessage('Настройки сохранены')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-neutral-900">Настройки</h1>
        <p className="text-neutral-500 mt-1">Управление контактами и доступом к админке</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ContactSettings formData={formData} onChange={handleContactChange} />

        <div className="flex items-center justify-between">
          <div>
            {successMessage && (
              <span className="text-green-600 text-sm font-medium">{successMessage}</span>
            )}
          </div>
          <Button type="submit" disabled={isSaving}>
            <Save size={18} className="mr-2" />
            {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </div>
      </form>

      <PasswordSettings onChangePassword={changePassword} />
    </div>
  )
}
