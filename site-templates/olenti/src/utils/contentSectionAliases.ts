export const CONTENT_SECTION_READ_ALIASES: Record<string, readonly string[]> = {
  value_block: ['value_block', 'aromatherapy'],
}

export function contentSectionCandidates(section: string): readonly string[] {
  return CONTENT_SECTION_READ_ALIASES[section] ?? [section]
}
