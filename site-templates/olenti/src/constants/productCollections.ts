/**
 * Product collection labels (canonical starter/signature + legacy runtime keys).
 */
export const PRODUCT_COLLECTION_LABELS: Record<string, string> = {
  starter: 'Стартовые',
  signature: 'Флагманские',
  primorye: 'Коллекция (legacy)',
  wardrobe: 'Коллекция (legacy)',
  rituals: 'Коллекция (legacy)',
  exclusive: 'Эксклюзив (legacy)',
}

export const PRODUCT_COLLECTION_COLORS: Record<string, string> = {
  starter: 'from-emerald-500 to-teal-600',
  signature: 'from-purple-500 to-indigo-600',
  primorye: 'from-emerald-500 to-teal-600',
  wardrobe: 'from-purple-500 to-indigo-600',
  rituals: 'from-amber-500 to-orange-600',
  exclusive: 'from-rose-500 to-pink-600',
}

export const PRODUCT_COLLECTION_CHIP_STYLES: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  starter: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-900/30',
    darkText: 'dark:text-emerald-400',
  },
  signature: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-400',
  },
  primorye: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-900/30',
    darkText: 'dark:text-emerald-400',
  },
  wardrobe: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-400',
  },
  rituals: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    darkBg: 'dark:bg-amber-900/30',
    darkText: 'dark:text-amber-400',
  },
  exclusive: {
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    darkBg: 'dark:bg-rose-900/30',
    darkText: 'dark:text-rose-400',
  },
}

export function productCollectionChipClass(collection: string): string {
  const styles = PRODUCT_COLLECTION_CHIP_STYLES[collection]
  if (!styles) return 'bg-neutral-100 text-neutral-700 dark:bg-slate-800 dark:text-slate-300'
  return `${styles.bg} ${styles.text} ${styles.darkBg} ${styles.darkText}`
}

