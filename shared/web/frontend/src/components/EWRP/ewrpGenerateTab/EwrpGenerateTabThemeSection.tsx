/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step-2 presentation theme fieldset for the EWRP Generate form.
 *
 * Invariants:
 * - Props-only presentational — no local store.
 * - Theme options come from `EWRP_PRESENTATION_THEME_IDS` (chunks barrel).
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `EwrpGeneratorChunks.tsx`
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	EWRP_PRESENTATION_THEME_IDS,
	EwrpFormSectionHeader,
	EwrpDesktopSelect,
} from '../EwrpGeneratorChunks';

export type EwrpGenerateTabThemeSectionProps = {
	presentationTheme: string;
	onPresentationThemeChange: (value: string) => void;
	shellSelectClass: string;
	formLocked: boolean;
	ewrpFieldsetShellClass: string;
};

export function EwrpGenerateTabThemeSection({
	presentationTheme,
	onPresentationThemeChange,
	shellSelectClass,
	formLocked,
	ewrpFieldsetShellClass,
}: EwrpGenerateTabThemeSectionProps) {
	const { t } = useTranslation('ewrp');

	return (
		<fieldset className={ewrpFieldsetShellClass}>
			<legend className="sr-only">{t('form.pdfSectionCaption')}</legend>
			<EwrpFormSectionHeader
				step="2"
				badge="defaults"
				title={t('form.pdfLookTitle')}
				hint={t('form.pdfLookHint')}
			/>
			<div className="max-w-full sm:max-w-2xl">
				<label
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'mb-1.5 block font-medium text-(--desktop-text-secondary)'
					)}
					htmlFor="ewrp-presentation-theme"
				>
					{t('form.stylingLabel')}
				</label>
				<EwrpDesktopSelect
					id="ewrp-presentation-theme"
					selectClassName={shellSelectClass}
					value={presentationTheme}
					onChange={(e) => onPresentationThemeChange(e.target.value)}
					disabled={formLocked}
					aria-describedby="ewrp-presentation-theme-desc"
				>
					{EWRP_PRESENTATION_THEME_IDS.map((themeId) => (
						<option key={themeId} value={themeId}>
							{t(`themes.${themeId}.title`)}
						</option>
					))}
				</EwrpDesktopSelect>
				<p
					id="ewrp-presentation-theme-desc"
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-2 leading-relaxed text-(--desktop-text-secondary)'
					)}
				>
					{t(`themes.${presentationTheme}.description`)}
				</p>
			</div>
		</fieldset>
	);
}
