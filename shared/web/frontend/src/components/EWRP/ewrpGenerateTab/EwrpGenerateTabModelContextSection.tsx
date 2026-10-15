/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step-4 model-context fieldset (web search quality + extra context) for Generate form.
 *
 * Invariants:
 * - Props-only presentational — no local store.
 * - Persists web-search quality via `writeStoredEwrpWebSearchQuality` on change.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `ewrpWebSearchQuality.ts`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	EWRP_EXTRA_CONTEXT_MAX,
	EwrpFormSectionHeader,
	EwrpDesktopSelect,
} from '../EwrpGeneratorChunks';
import {
	type EwrpWebSearchQuality,
	EWRP_WEB_SEARCH_QUALITY_OPTIONS,
	isEwrpWebSearchQuality,
	writeStoredEwrpWebSearchQuality,
} from '../ewrpWebSearchQuality';

export type EwrpGenerateTabModelContextSectionProps = {
	webSearchQuality: EwrpWebSearchQuality;
	onWebSearchQualityChange: (value: EwrpWebSearchQuality) => void;
	extraContext: string;
	onExtraContextChange: (value: string) => void;
	shellField: string;
	shellSelectClass: string;
	formLocked: boolean;
	ewrpFieldsetOptionalShellClass: string;
};

export function EwrpGenerateTabModelContextSection({
	webSearchQuality,
	onWebSearchQualityChange,
	extraContext,
	onExtraContextChange,
	shellField,
	shellSelectClass,
	formLocked,
	ewrpFieldsetOptionalShellClass,
}: EwrpGenerateTabModelContextSectionProps) {
	const { t } = useTranslation('ewrp');

	return (
		<fieldset className={ewrpFieldsetOptionalShellClass}>
			<legend className="sr-only">{t('form.extraLegend')}</legend>
			<EwrpFormSectionHeader
				step="4"
				badge="optional"
				title={t('form.modelContextTitle')}
				hint={t('form.modelContextHint')}
			/>
			<div className="mb-4 max-w-full sm:max-w-2xl">
				<label
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'mb-1.5 block font-medium text-(--desktop-text-secondary)'
					)}
					htmlFor="ewrp-web-search-quality"
				>
					{t('form.webSearchQualityLabel')}
				</label>
				<EwrpDesktopSelect
					id="ewrp-web-search-quality"
					selectClassName={shellSelectClass}
					value={webSearchQuality}
					onChange={(e) => {
						const next = e.target.value;
						if (!isEwrpWebSearchQuality(next)) return;
						onWebSearchQualityChange(next);
						writeStoredEwrpWebSearchQuality(next);
					}}
					disabled={formLocked}
					aria-describedby="ewrp-web-search-quality-desc"
				>
					{EWRP_WEB_SEARCH_QUALITY_OPTIONS.map((tier) => (
						<option key={tier} value={tier}>
							{t(`form.webSearchQuality.${tier}`)}
						</option>
					))}
				</EwrpDesktopSelect>
				<p
					id="ewrp-web-search-quality-desc"
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-2 leading-relaxed text-(--desktop-text-secondary)'
					)}
				>
					{t('form.webSearchQualityHint')}
				</p>
			</div>
			<div>
				<label
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'mb-1.5 block font-medium text-(--desktop-text-dim)'
					)}
					htmlFor="ewrp-extra-context"
				>
					{t('form.extraLabel')}
				</label>
				<textarea
					id="ewrp-extra-context"
					value={extraContext}
					onChange={(e) => onExtraContextChange(e.target.value)}
					rows={4}
					maxLength={EWRP_EXTRA_CONTEXT_MAX}
					placeholder={t('form.modelContextPlaceholder')}
					className={cn(
						shellField,
						'resize-y border-(--desktop-border-subtle)/55 bg-(--desktop-surface-app)/35'
					)}
					disabled={formLocked}
				/>
				<div
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-1.5 flex flex-wrap items-center justify-between gap-2 text-(--desktop-text-dim)'
					)}
				>
					<span className="min-w-0 flex-1">{t('form.extraFootnote')}</span>
					<span
						className="shrink-0 rounded-md border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/50 px-2 py-0.5 tabular-nums text-[11px] text-(--desktop-text-dim)"
						aria-live="polite"
					>
						{extraContext.length} / {EWRP_EXTRA_CONTEXT_MAX}
					</span>
				</div>
			</div>
		</fieldset>
	);
}
