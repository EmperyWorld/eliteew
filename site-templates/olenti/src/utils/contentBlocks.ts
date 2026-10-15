import type { HeroContent } from '@components/organisms/HeroSection/HeroSection'
import type { PageContentMap } from '@hooks/usePageContent'

/** CMS stores hero as flat keys under page.section (e.g. home.hero.headline_1). */
export function heroContentFromBlocks(blocks: PageContentMap | null | undefined, page: string): HeroContent | undefined {
  const raw = blocks?.[page]?.hero
  if (!raw || typeof raw !== 'object') {
    return undefined
  }
  const pick = (key: keyof HeroContent): string | undefined => {
    const v = raw[key as string]
    return typeof v === 'string' ? v : undefined
  }
  return {
    badge: pick('badge'),
    headline_1: pick('headline_1'),
    headline_2: pick('headline_2'),
    lead: pick('lead'),
    cta_shop: pick('cta_shop'),
    cta_consultation: pick('cta_consultation'),
    card_label: pick('card_label'),
    card_title: pick('card_title'),
    card_description: pick('card_description'),
    card_notes: pick('card_notes'),
    card_footer: pick('card_footer'),
    badge_small_label: pick('badge_small_label'),
    badge_small_text: pick('badge_small_text'),
  }
}
