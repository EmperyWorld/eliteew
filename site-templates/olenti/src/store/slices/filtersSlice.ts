import { create } from 'zustand'
import type { Filter, SortOption } from '@typings/common'

interface FiltersStore {
  filters: Filter
  sortBy: SortOption
  
  setFilters: (filters: Filter) => void
  setSortBy: (sortBy: SortOption) => void
  clearFilters: () => void
}

export const useFiltersStore = create<FiltersStore>((set) => ({
  filters: {},
  sortBy: 'newest',

  setFilters: (filters) => set({ filters }),
  setSortBy: (sortBy) => set({ sortBy }),
  clearFilters: () => set({ filters: {}, sortBy: 'newest' }),
}))
