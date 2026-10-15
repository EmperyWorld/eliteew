import React, { useEffect, useMemo, useState } from 'react'
import { Save, RefreshCcw, Shield, Plus, Trash2, Settings2, Flag, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import { Card } from '@components/atoms/Card'
import { fetchConfig, upsertConfigItems, fetchFeatureFlags, upsertFeatureFlags } from '@services/api/config'

const typeOptions = [
  { label: 'string', value: 'string', color: 'bg-blue-100 text-blue-700' },
  { label: 'int', value: 'int', color: 'bg-purple-100 text-purple-700' },
  { label: 'bool', value: 'bool', color: 'bg-amber-100 text-amber-700' },
  { label: 'json', value: 'json', color: 'bg-emerald-100 text-emerald-700' },
  { label: 'url', value: 'url', color: 'bg-cyan-100 text-cyan-700' },
  { label: 'email', value: 'email', color: 'bg-pink-100 text-pink-700' },
  { label: 'phone', value: 'phone', color: 'bg-orange-100 text-orange-700' },
]

type ConfigRow = {
  key: string
  type: string
  value: string
  description?: string
}

type FlagRow = {
  key: string
  isEnabled: boolean
  scope?: string
  rollout?: number | null
  description?: string
}

const namespaces = [
  { id: 'site', label: 'Сайт', icon: '🌐' },
  { id: 'bot', label: 'Бот', icon: '🤖' },
  { id: 'notifications', label: 'Уведомления', icon: '🔔' },
  { id: 'limits', label: 'Лимиты', icon: '⚡' },
]

export const ConfigPage: React.FC = () => {
  const [namespace, setNamespace] = useState<string>('site')
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingFlags, setSavingFlags] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await fetchConfig(namespace)
      const mapped: ConfigRow[] = items.map((i) => ({
        key: i.key,
        type: i.type,
        value: typeof i.valueJson === 'object' ? JSON.stringify(i.valueJson) : String(i.valueJson ?? ''),
        description: i.description ?? '',
      }))
      setRows(mapped)

      if (namespace === 'site') {
        const fl = await fetchFeatureFlags()
        setFlags(fl.map((f) => ({
          key: f.key,
          isEnabled: f.isEnabled,
          scope: f.scope || '',
          rollout: f.rollout ?? undefined,
          description: f.description || '',
        })))
      } else {
        setFlags([])
      }
    } catch {
      setError('Не удалось загрузить конфиг')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace])

  const handleChangeRow = (index: number, field: keyof ConfigRow, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { key: '', type: 'string', value: '', description: '' }])
  }

  const addFlag = () => {
    setFlags((prev) => [...prev, { key: '', isEnabled: false, scope: '', description: '' }])
  }

  const removeFlag = (index: number) => {
    setFlags((prev) => prev.filter((_, i) => i !== index))
  }

  const saveConfig = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const items = rows
        .filter((r) => r.key.trim())
        .map((r) => ({
          key: r.key.trim(),
          type: r.type,
          value: parseValue(r.type, r.value),
          description: r.description,
        }))
      await upsertConfigItems(namespace, items)
      setMessage('Конфигурация сохранена')
    } catch {
      setError('Ошибка сохранения')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const saveFlags = async () => {
    setSavingFlags(true)
    setError(null)
    setMessage(null)
    try {
      const items = flags
        .filter((f) => f.key.trim())
        .map((f) => ({
          key: f.key.trim(),
          isEnabled: f.isEnabled,
          scope: f.scope || undefined,
          rollout: typeof f.rollout === 'number' ? f.rollout : null,
          description: f.description,
        }))
      await upsertFeatureFlags(items)
      setMessage('Флаги сохранены')
    } catch {
      setError('Ошибка сохранения флагов')
    } finally {
      setSavingFlags(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const flagControls = useMemo(() => namespace === 'site', [namespace])
  const currentNs = namespaces.find(ns => ns.id === namespace)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-neutral-900 flex items-center gap-3">
            <Settings2 className="text-neutral-400" />
            Конфигурация
          </h1>
          <p className="text-neutral-500 mt-1">Системные настройки и feature flags</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCcw size={16} className="mr-2" />}
          Обновить
        </Button>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <CheckCircle size={16} />
          {message}
        </div>
      )}

      {/* Namespace tabs */}
      <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl w-fit">
        {namespaces.map((ns) => (
          <button
            key={ns.id}
            onClick={() => setNamespace(ns.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              namespace === ns.id
                ? 'bg-white shadow-sm text-neutral-900'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>{ns.icon}</span>
            {ns.label}
          </button>
        ))}
      </div>

      {/* Config Section */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings2 size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Конфигурация {currentNs?.label}</h3>
              <p className="text-xs text-neutral-500">{rows.length} параметров</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus size={14} className="mr-1" />
              Добавить
            </Button>
            <Button size="sm" onClick={saveConfig} disabled={saving}>
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
              Сохранить
            </Button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <Settings2 size={32} className="mx-auto mb-2 text-neutral-300" />
              <p>Нет параметров конфигурации</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={addRow}>
                <Plus size={14} className="mr-1" />
                Добавить первый параметр
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <div className="col-span-3">Ключ</div>
                <div className="col-span-2">Тип</div>
                <div className="col-span-4">Значение</div>
                <div className="col-span-2">Описание</div>
                <div className="col-span-1"></div>
              </div>
              {rows.map((row, idx) => (
                <div key={`${row.key}-${idx}`} className="grid grid-cols-12 gap-2 items-center p-2 bg-neutral-50/50 rounded-lg hover:bg-neutral-100/50 transition-colors">
                  <Input
                    className="col-span-3 text-sm"
                    placeholder="config_key"
                    value={row.key}
                    onChange={(e) => handleChangeRow(idx, 'key', e.target.value)}
                  />
                  <select
                    className="col-span-2 border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                    value={row.type}
                    onChange={(event) => handleChangeRow(idx, 'type', event.target.value)}
                  >
                    {typeOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="col-span-4 text-sm font-mono"
                    placeholder="value"
                    value={row.value}
                    onChange={(e) => handleChangeRow(idx, 'value', e.target.value)}
                  />
                  <Input
                    className="col-span-2 text-sm"
                    placeholder="описание..."
                    value={row.description || ''}
                    onChange={(e) => handleChangeRow(idx, 'description', e.target.value)}
                  />
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeRow(idx)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Feature Flags Section */}
      {flagControls && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Flag size={18} className="text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                  Feature Flags
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                    <Shield size={10} />
                    site
                  </span>
                </h3>
                <p className="text-xs text-neutral-500">{flags.length} флагов</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addFlag}>
                <Plus size={14} className="mr-1" />
                Добавить
              </Button>
              <Button size="sm" onClick={saveFlags} disabled={savingFlags} className="bg-purple-600 hover:bg-purple-500">
                {savingFlags ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                Сохранить
              </Button>
            </div>
          </div>

          <div className="p-4">
            {flags.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <Flag size={32} className="mx-auto mb-2 text-neutral-300" />
                <p>Нет feature flags</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={addFlag}>
                  <Plus size={14} className="mr-1" />
                  Добавить первый флаг
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  <div className="col-span-3">Ключ</div>
                  <div className="col-span-2">Статус</div>
                  <div className="col-span-2">Scope</div>
                  <div className="col-span-2">Rollout %</div>
                  <div className="col-span-2">Описание</div>
                  <div className="col-span-1"></div>
                </div>
                {flags.map((flag, idx) => (
                  <div key={`${flag.key}-${idx}`} className="grid grid-cols-12 gap-2 items-center p-2 bg-neutral-50/50 rounded-lg hover:bg-neutral-100/50 transition-colors">
                    <Input
                      className="col-span-3 text-sm font-mono"
                      placeholder="feature_key"
                      value={flag.key}
                      onChange={(e) => setFlags((prev) => prev.map((f, i) => (i === idx ? { ...f, key: e.target.value } : f)))}
                    />
                    <div className="col-span-2">
                      <button
                        onClick={() => setFlags((prev) => prev.map((f, i) => (i === idx ? { ...f, isEnabled: !f.isEnabled } : f)))}
                        className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          flag.isEnabled
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                        }`}
                      >
                        {flag.isEnabled ? '✓ Enabled' : '✗ Disabled'}
                      </button>
                    </div>
                    <Input
                      className="col-span-2 text-sm"
                      placeholder="all"
                      value={flag.scope || ''}
                      onChange={(e) => setFlags((prev) => prev.map((f, i) => (i === idx ? { ...f, scope: e.target.value } : f)))}
                    />
                    <Input
                      className="col-span-2 text-sm"
                      placeholder="100"
                      type="number"
                      min={0}
                      max={100}
                      value={flag.rollout ?? ''}
                      onChange={(e) =>
                        setFlags((prev) =>
                          prev.map((f, i) => (i === idx ? { ...f, rollout: e.target.value ? Number(e.target.value) : undefined } : f))
                        )
                      }
                    />
                    <Input
                      className="col-span-2 text-sm"
                      placeholder="описание..."
                      value={flag.description || ''}
                      onChange={(e) =>
                        setFlags((prev) => prev.map((f, i) => (i === idx ? { ...f, description: e.target.value } : f)))
                      }
                    />
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeFlag(idx)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

function parseValue(type: string, raw: string): unknown {
  switch (type) {
    case 'int':
      return Number(raw || 0)
    case 'bool':
      return raw === 'true' || raw === '1'
    case 'json':
      try {
        return raw ? JSON.parse(raw) : {}
      } catch {
        return {}
      }
    default:
      return raw
  }
}
