/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step-3 content fieldset (optional title + slide count + first-slide cover) for the EWRP Generate form.
 *
 * Invariants:
 * - Props-only presentational — no local store.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	EWRP_FIRST_SLIDE_STYLE_IDS,
	EwrpFormSectionHeader,
	EwrpDesktopSelect,
} from '../EwrpGeneratorChunks';

export type EwrpGenerateTabContentSectionProps = {
	title: string;
	onTitleChange: (value: string) => void;
	numSlides: number;
	onNumSlidesChange: (value: number) => void;
	firstSlideStyle: string;
	onFirstSlideStyleChange: (value: string) => void;
	shellField: string;
	shellSelectClass: string;
	formLocked: boolean;
	ewrpFieldsetShellClass: string;
	ewrpOptionalFieldBlockClass: string;
};

export function EwrpGenerateTabContentSection({
	title,
	onTitleChange,
	numSlides,
	onNumSlidesChange,
	firstSlideStyle,
	onFirstSlideStyleChange,
	shellField,
	shellSelectClass,
	formLocked,
	ewrpFieldsetShellClass,
	ewrpOptionalFieldBlockClass,
}: EwrpGenerateTabContentSectionProps) {
	const { t } = useTranslation('ewrp');

	return (
		<fieldset className={ewrpFieldsetShellClass}>
			<legend className="sr-only">{t('form.mainParamsLegend')}</legend>
			<EwrpFormSectionHeader
				step="3"
				title={t('form.contentTitle')}
				hint={t('form.contentHint')}
			/>
			<div className={ewrpOptionalFieldBlockClass}>
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<span className="inline-flex shrink-0 items-center rounded-full border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
						{t('form.badgeOptional')}
					</span>
					<span
						className={cn(DESKTOP_TYPOGRAPHY.meta, 'text-(--desktop-text-dim)')}
					>
						{t('form.titleFieldCaption')}
					</span>
				</div>
				<label className="sr-only" htmlFor="ewrp-title">
					{t('form.titleLabel')}
				</label>
				<input
					id="ewrp-title"
					type="text"
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					placeholder={t('form.titlePlaceholder')}
					className={cn(
						shellField,
						'border-(--desktop-border-subtle)/55 bg-(--desktop-surface-app)/40'
					)}
					disabled={formLocked}
					aria-label={t('form.titleLabel')}
				/>
			</div>
			<div className={cn(ewrpOptionalFieldBlockClass, 'mt-5')}>
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<span className="inline-flex shrink-0 items-center rounded-full border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
						{t('form.badgeOptional')}
					</span>
					<span
						className={cn(DESKTOP_TYPOGRAPHY.meta, 'text-(--desktop-text-dim)')}
					>
						{t('form.firstSlideStyleCaption')}
					</span>
				</div>
				<label
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'mb-1.5 block font-medium text-(--desktop-text-secondary)'
					)}
					htmlFor="ewrp-first-slide-style"
				>
					{t('form.firstSlideStyleLabel')}
				</label>
				<EwrpDesktopSelect
					id="ewrp-first-slide-style"
					selectClassName={shellSelectClass}
					value={firstSlideStyle}
					onChange={(e) => onFirstSlideStyleChange(e.target.value)}
					disabled={formLocked}
					aria-describedby="ewrp-first-slide-style-desc"
				>
					{EWRP_FIRST_SLIDE_STYLE_IDS.map((styleId) => (
						<option key={styleId} value={styleId}>
							{t(`form.firstSlideStyles.${styleId}.title`)}
						</option>
					))}
				</EwrpDesktopSelect>
				<p
					id="ewrp-first-slide-style-desc"
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-2 leading-relaxed text-(--desktop-text-secondary)'
					)}
				>
					{t(`form.firstSlideStyles.${firstSlideStyle}.description`)}
				</p>
			</div>
			<div
				className={cn(
					'mt-5 grid gap-4 rounded-2xl border border-(--desktop-border-subtle)/60 bg-[rgb(var(--desktop-accent-rgb)/0.045)] p-4 ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.08)] sm:p-5'
				)}
			>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'font-semibold text-(--desktop-text-secondary)'
					)}
				>
					{t('form.volumeLegend')}
				</p>
				<div className="max-w-full">
					<label
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'mb-1.5 block font-medium text-(--desktop-text-secondary)'
						)}
						htmlFor="ewrp-num-slides"
					>
						{t('form.slideCountLabel')}
					</label>
					<input
						id="ewrp-num-slides"
						type="number"
						min={3}
						max={20}
						value={numSlides}
						onChange={(e) => onNumSlidesChange(Number(e.target.value) || 5)}
						className={cn(shellField, 'max-w-36 tabular-nums')}
						disabled={formLocked}
						aria-describedby="ewrp-volume-auto-layout-hint"
					/>
				</div>
				<p
					id="ewrp-volume-auto-layout-hint"
					className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-relaxed')}
				>
					{t('form.volumeAutoLayoutNote')}
				</p>
			</div>
		</fieldset>
	);
}
