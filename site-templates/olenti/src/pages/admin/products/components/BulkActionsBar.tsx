import React from 'react'
import { X, Trash2, DollarSign, PackageCheck, PackageX, Percent, Tag } from 'lucide-react'
import { Button } from '@components/atoms/Button'

interface BulkActionsBarProps {
  selectedCount: number
  selectedValue?: number
  onClearSelection: () => void
  onDelete: () => void
  onUpdateStock: (inStock: boolean) => void
  onUpdatePrice: (percentage: number) => void
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  selectedValue = 0,
  onClearSelection,
  onDelete,
  onUpdateStock,
  onUpdatePrice
}) => {
  const [showPriceMenu, setShowPriceMenu] = React.useState(false)
  const priceMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (priceMenuRef.current && !priceMenuRef.current.contains(event.target as Node)) {
        setShowPriceMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (selectedCount === 0) return null

  const handleCustomPrice = () => {
    const input = prompt('Введите процент изменения цены (например, 10 для +10% или -10 для скидки):')
    if (input && !isNaN(Number(input))) {
      onUpdatePrice(Number(input))
    }
    setShowPriceMenu(false)
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/50 backdrop-blur-xl">
        <div className="flex items-center gap-1 p-2">
          {/* Selection info */}
          <div className="flex items-center gap-3 px-3 border-r border-slate-700">
            <div className="relative">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-sm font-bold w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/40">
                {selectedCount}
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-400 rounded-full animate-ping" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-medium text-slate-300">выбрано</span>
              {selectedValue > 0 && (
                <p className="text-xs text-emerald-400 font-semibold">
                  {selectedValue.toLocaleString('ru-RU')} ₽
                </p>
              )}
            </div>
            <button
              onClick={onClearSelection}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all hover:scale-110"
              aria-label="Снять выделение"
            >
              <X size={14} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 px-2">
            {/* Stock actions */}
            <Button
              size="sm"
              onClick={() => onUpdateStock(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-all hover:scale-105"
            >
              <PackageCheck size={14} className="mr-1.5" />
              <span className="hidden sm:inline">В наличии</span>
              <span className="sm:hidden">✓</span>
            </Button>

            <Button
              size="sm"
              onClick={() => onUpdateStock(false)}
              className="bg-amber-600 hover:bg-amber-500 text-white border-0 shadow-lg shadow-amber-600/30 hover:shadow-amber-500/40 transition-all hover:scale-105"
            >
              <PackageX size={14} className="mr-1.5" />
              <span className="hidden sm:inline">Нет в наличии</span>
              <span className="sm:hidden">✕</span>
            </Button>

            {/* Price dropdown */}
            <div className="relative" ref={priceMenuRef}>
              <Button
                size="sm"
                onClick={() => setShowPriceMenu(!showPriceMenu)}
                className="bg-slate-700 hover:bg-slate-600 text-white border-0 transition-all hover:scale-105"
              >
                <Tag size={14} className="mr-1.5" />
                <span className="hidden sm:inline">Цена</span>
                <span className="sm:hidden">₽</span>
              </Button>

              {showPriceMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700 py-1 min-w-40 overflow-hidden">
                  <div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Изменить цену</div>
                  <button
                    onClick={() => { onUpdatePrice(10); setShowPriceMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-slate-700 transition-colors"
                  >
                    <Percent size={14} /> +10%
                  </button>
                  <button
                    onClick={() => { onUpdatePrice(20); setShowPriceMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-slate-700 transition-colors"
                  >
                    <Percent size={14} /> +20%
                  </button>
                  <button
                    onClick={() => { onUpdatePrice(-10); setShowPriceMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                  >
                    <Percent size={14} /> -10% (скидка)
                  </button>
                  <button
                    onClick={() => { onUpdatePrice(-20); setShowPriceMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                  >
                    <Percent size={14} /> -20% (скидка)
                  </button>
                  <hr className="my-1 border-slate-700" />
                  <button
                    onClick={handleCustomPrice}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <DollarSign size={14} /> Другой %...
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-slate-700 mx-1" />

            {/* Delete */}
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-lg shadow-red-600/30 hover:shadow-red-500/40 transition-all hover:scale-105"
              onClick={onDelete}
            >
              <Trash2 size={14} className="mr-1.5" />
              <span className="hidden sm:inline">Удалить</span>
              <span className="sm:hidden">🗑</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
