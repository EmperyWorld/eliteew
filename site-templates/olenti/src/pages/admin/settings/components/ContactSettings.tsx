import { Card } from '@components/atoms/Card'
import { Input } from '@components/atoms/Input'
import { Clock, Globe, Mail, MapPin, Phone } from 'lucide-react'
import React from 'react'

interface ContactSettingsProps {
  formData: {
    contactPhone: string
    contactEmail: string
    contactAddress: string
    workingHours: string
  }
  onChange: (field: string, value: string) => void
}

export const ContactSettings: React.FC<ContactSettingsProps> = ({ formData, onChange }) => {
  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary-100">
          <Globe size={20} className="text-primary-600" />
        </div>
        <h2 className="text-lg font-semibold text-neutral-900">Контактная информация</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
            <Phone size={16} className="text-neutral-400" />
            Телефон
          </label>
          <Input
            value={formData.contactPhone}
            onChange={(e) => onChange('contactPhone', e.target.value)}
            placeholder="+7 (999) 123-45-67"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
            <Mail size={16} className="text-neutral-400" />
            Email
          </label>
          <Input
            type="email"
            value={formData.contactEmail}
            onChange={(e) => onChange('contactEmail', e.target.value)}
            placeholder="hello@example.com"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
            <MapPin size={16} className="text-neutral-400" />
            Адрес
          </label>
          <Input
            value={formData.contactAddress}
            onChange={(e) => onChange('contactAddress', e.target.value)}
            placeholder="Город, улица, офис или адрес самовывоза"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
            <Clock size={16} className="text-neutral-400" />
            Режим работы
          </label>
          <Input
            value={formData.workingHours}
            onChange={(e) => onChange('workingHours', e.target.value)}
            placeholder="Пн-Пт: 10:00 – 19:00"
          />
        </div>
      </div>
    </Card>
  )
}
