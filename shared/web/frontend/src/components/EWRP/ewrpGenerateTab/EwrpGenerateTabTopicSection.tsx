/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step-1 topic hero fieldset for the EWRP Generate form.
 *
 * Invariants:
 * - Props-only presentational — no local store.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `EwrpFormSectionHeader` (chunks)
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { EwrpFormSectionHeader } from '../EwrpGeneratorChunks';

export type EwrpGenerateTabTopicSectionProps = {
	topic: string;
	onTopicChange: (value: string) => void;
	shellField: string;
	formLocked: boolean;
	ewrpTopicHeroClass: string;
};

export function EwrpGenerateTabTopicSection({
	topic,
	onTopicChange,
	shellField,
	formLocked,
	ewrpTopicHeroClass,
}: EwrpGenerateTabTopicSectionProps) {
	const { t } = useTranslation('ewrp');

	return (
		<div className={ewrpTopicHeroClass}>
			<EwrpFormSectionHeader
				step="1"
				badge="required"
				title={t('form.sectionTopicTitle')}
				hint={t('form.sectionTopicHint')}
			/>
			<div>
				<label
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'mb-1.5 block font-semibold text-(--desktop-text-primary)'
					)}
					htmlFor="ewrp-topic"
				>
					{t('form.topicLabel')}
				</label>
				<input
					id="ewrp-topic"
					type="text"
					value={topic}
					onChange={(e) => onTopicChange(e.target.value)}
					placeholder={t('form.topicPlaceholder')}
					required
					aria-required={true}
					className={cn(
						shellField,
						'border-[rgb(var(--desktop-accent-rgb)/0.35)] shadow-[inset_0_1px_0_rgb(var(--desktop-accent-rgb)/0.06)]'
					)}
					disabled={formLocked}
				/>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-1.5 leading-relaxed text-(--desktop-text-secondary)'
					)}
				>
					{t('form.topicHint')}
				</p>
			</div>
		</div>
	);
}
