import { useDebounce } from '@hooks/useDebounce'
import { apiClient } from '@services/api/client'
import { Calendar, Package, Search, ShoppingCart, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchResult {
  products: Array<{ id: string; name: string; price: number; category: string }>
  orders: Array<{ id: string; orderNumber: string; customerName: string; status: string }>
  users: Array<{ id: string; name: string; email: string }>
  bookings: Array<{ id: string; guestName: string; consultation?: { title: string }; masterclass?: { title: string } }>
}

// Simple hook
function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return
      }
      handler()
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  useOnClickOutside(containerRef, () => setIsOpen(false))

  useEffect(() => {
    const search = async () => {
      if (!debouncedQuery.trim()) {
        setResults(null)
        return
      }

      setLoading(true)
      try {
        const { data } = await apiClient.get<SearchResult>(`/admin/search?q=${debouncedQuery}`)
        setResults(data)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }

    search()
  }, [debouncedQuery])

  const handleNavigate = (path: string) => {
    navigate(path)
    setIsOpen(false)
    setQuery('')
  }

  const hasResults = results && (
    results.products.length > 0 ||
    results.orders.length > 0 ||
    results.bookings.length > 0
  )

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary-500 transition-colors" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Поиск товаров, заказов, клиентов..."
          className="w-full pl-11 pr-20 py-2.5 bg-neutral-100/80 border border-transparent rounded-xl text-sm placeholder:text-neutral-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 focus:bg-white transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query ? (
            <button
              onClick={() => {
                setQuery('')
                setResults(null)
              }}
              className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 rounded-md transition-colors"
              aria-label="Очистить поиск"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 bg-neutral-200/80 rounded border border-neutral-300/50">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {isOpen && (query.trim().length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-neutral-200/80 max-h-[70vh] overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-neutral-500 mt-3">Поиск...</p>
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center">
              <Search size={32} className="mx-auto text-neutral-200 mb-2" />
              <p className="text-sm text-neutral-500">Ничего не найдено по запросу "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Products */}
              {results?.products.length > 0 && (
                <div className="mb-1">
                  <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-100">
                    <Package size={12} className="text-primary-400" /> Товары
                    <span className="ml-auto text-neutral-300">{results.products.length}</span>
                  </div>
                  {results.products.map(product => (
                    <button
                      key={product.id}
                      onClick={() => handleNavigate(`/admin/products/${product.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-primary-50/50 flex justify-between items-center transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                          <Package size={14} className="text-primary-600" />
                        </span>
                        <span className="text-sm font-medium text-neutral-900 group-hover:text-primary-700">{product.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-neutral-600">{product.price.toLocaleString()} ₽</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Orders */}
              {results?.orders.length > 0 && (
                <div className="mb-1">
                  <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-100">
                    <ShoppingCart size={12} className="text-orange-400" /> Заказы
                    <span className="ml-auto text-neutral-300">{results.orders.length}</span>
                  </div>
                  {results.orders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => handleNavigate(`/admin/orders?id=${order.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50/50 flex justify-between items-center transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <ShoppingCart size={14} className="text-orange-600" />
                        </span>
                        <div>
                          <span className="text-sm font-mono font-semibold text-neutral-900 group-hover:text-orange-700">#{order.orderNumber}</span>
                          <span className="text-xs text-neutral-500 ml-2">{order.customerName}</span>
                        </div>
                      </div>
                      <span className="text-xs font-medium bg-neutral-100 px-2 py-1 rounded-full">{order.status}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Bookings */}
              {results?.bookings.length > 0 && (
                <div className="mb-1">
                  <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-100">
                    <Calendar size={12} className="text-blue-400" /> Записи
                    <span className="ml-auto text-neutral-300">{results.bookings.length}</span>
                  </div>
                  {results.bookings.map(booking => (
                    <button
                      key={booking.id}
                      onClick={() => handleNavigate(`/admin/bookings`)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Calendar size={14} className="text-blue-600" />
                        </span>
                        <div>
                          <div className="text-sm font-medium text-neutral-900 group-hover:text-blue-700">
                            {booking.consultation?.title || booking.masterclass?.title || 'Запись'}
                          </div>
                          <div className="text-xs text-neutral-500">{booking.guestName}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
