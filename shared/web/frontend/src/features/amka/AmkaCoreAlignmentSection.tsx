/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loads and displays AmkaCoreEngine alignment for the selected marketing run on demand (separate query, no poll).
 * Surfaces pulse + standalone-style projection derived from the persisted master plan path.
 *
 * Invariants:
 * - One fetch per run id until manual refresh; detail polling must not re-trigger this query.
 * - User-visible strings use the marketing i18n namespace.
 *
 * Related:
 * - src/hooks/api/useAmka.ts
 * - src/features/amka/AmkaCoreAlignmentPanel.tsx
 * - shared/api/services/amka_core/marketing_core_bridge.py
 */
import { useTranslation } from 'react-i18next';

import { AmkaCoreAlignmentPanel } from '@/features/amka/AmkaCoreAlignmentPanel';
import { useAmkaCoreAlignment } from '@/hooks/api/useAmka';

export function AmkaCoreAlignmentSection({ runId }: { runId: string | null }) {
	const { t } = useTranslation('marketing');
	const q = useAmkaCoreAlignment(runId ?? undefined);

	if (!runId) {
		return null;
	}

	return (
		<AmkaCoreAlignmentPanel
			title={t('amkaView.coreAlignmentTitle')}
			subtitle={t('amkaView.coreAlignmentSubtitle')}
			ariaLabel={t('amkaView.coreAlignmentAria')}
			data={q.data}
			isLoading={q.isLoading}
			isError={q.isError}
			refetch={() => void q.refetch()}
		/>
	);
}
