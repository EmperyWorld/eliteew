/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing RAG source labels for streaming status (max 2 titles + overflow count).
 *
 * Invariants:
 * - Never surfaces raw paths or chunk ids — human doc titles only.
 *
 * Related:
 * - pages/Desktop/utils/assistantRagSourcesFooter.ts
 * - pages/Desktop/components/assistant/useAssistantMessageStream.ts
 */
import type { TFunction } from 'i18next';
import { collectRagSourceLabels } from '../../utils/assistantRagSourcesFooter';

/** Plain-text hint for streaming row / header badge. */
export function formatAssistantStreamingSourcesHint(
	sourceLabels: Array<string | null | undefined>,
	t: TFunction<'desktopUi', 'assistant'>
): string {
	const labels = collectRagSourceLabels(sourceLabels);
	if (labels.length === 0) return '';
	const shown = labels.slice(0, 2).map((label) => `«${label}»`);
	const overflow =
		labels.length > 2
			? t('streamingSourcesMore', { count: labels.length - 2 })
			: '';
	return t('streamingSourcesHint', {
		sources: `${shown.join('; ')}${overflow}`,
	});
}
