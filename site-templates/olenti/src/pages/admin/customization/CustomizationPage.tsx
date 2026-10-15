import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'
import { themePresets, type ThemeId } from '@constants/themePresets'
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice'
import clsx from 'clsx'
import { Check, Palette, RotateCcw, Save } from 'lucide-react'
import React, { useEffect, useState } from 'react'

export const CustomizationPage: React.FC = () => {
  const siteSettings = useSiteSettingsStore((state) => state.siteSettings)
  const updateSiteSettings = useSiteSettingsStore((state) => state.updateSiteSettings)
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    (siteSettings?.defaultTheme as ThemeId) || 'verdant-aurora'
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (siteSettings?.defaultTheme) {
      setSelectedTheme(siteSettings.defaultTheme as ThemeId)
    }
  }, [siteSettings])

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await updateSiteSettings({
        defaultTheme: selectedTheme,
      })
      setMessage({ type: 'success', text: 'Тема сохранена! Новые пользователи увидят эту тему по умолчанию.' })
    } catch {
      setMessage({ type: 'error', text: 'Ошибка сохранения темы' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setSelectedTheme('verdant-aurora')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-neutral-900">Кастомизация</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Настройка внешнего вида сайта для всех посетителей
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw size={16} className="mr-1" />
            Сбросить
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save size={16} className="mr-1" />
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      {message && (
        <div className={clsx(
          'p-4 rounded-xl text-sm',
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {message.text}
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-100 rounded-xl">
            <Palette size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Тема по умолчанию</h2>
            <p className="text-sm text-neutral-500">
              Выберите тему, которую увидят все новые посетители сайта
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {themePresets.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelectedTheme(theme.id as ThemeId)}
              className={clsx(
                'relative p-4 rounded-xl border-2 transition-all text-left',
                selectedTheme === theme.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
              )}
            >
              {selectedTheme === theme.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
              <div
                className="w-full h-16 rounded-lg mb-3"
                style={{ background: theme.preview }}
              />
              <h3 className="font-medium text-neutral-900 text-sm">{theme.name}</h3>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{theme.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Предпросмотр</h2>
        <div
          className="p-6 rounded-xl border"
          style={{
            background: themePresets.find(t => t.id === selectedTheme)?.variables['--gradient-app'] || '#fff',
          }}
        >
          <div className="max-w-md mx-auto space-y-4">
            <div
              className="p-4 rounded-xl backdrop-blur-sm"
              style={{
                background: themePresets.find(t => t.id === selectedTheme)?.variables['--theme-card-surface'] || 'white',
                borderColor: themePresets.find(t => t.id === selectedTheme)?.variables['--theme-card-border'] || '#e5e5e5',
                borderWidth: '1px',
              }}
            >
              <h3
                className="font-semibold mb-2"
                style={{ color: themePresets.find(t => t.id === selectedTheme)?.variables['--theme-heading-color'] || '#000' }}
              >
                Пример карточки
              </h3>
              <p
                className="text-sm"
                style={{ color: themePresets.find(t => t.id === selectedTheme)?.variables['--theme-body-text'] || '#666' }}
              >
                Так будет выглядеть контент на сайте с выбранной темой.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-amber-50 border-amber-200">
        <h3 className="font-semibold text-amber-800 mb-2">💡 Как это работает</h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• Выбранная тема будет применяться для всех новых посетителей сайта</li>
          <li>• Пользователи могут переключить тему через виджет на сайте</li>
          <li>• Их выбор сохраняется в браузере и имеет приоритет</li>
          <li>• При очистке кэша браузера снова применится тема по умолчанию</li>
        </ul>
      </Card>
    </div>
  )
}
