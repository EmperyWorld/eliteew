/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Everyday Personalize control: Desktop UI language RU | EN as a sticky strip
 * (not a full settings card — density SoT Everyday IA §4).
 *
 * Invariants:
 * - Switches i18n immediately; persists via profile language when authenticated.
 * - Uses `useOptionalAuth` so missing AuthProvider does not throw (local-only persist).
 *
 * Related:
 * - `utils/applyDesktopUiLanguage.ts`
 * - `DesktopSettingsPersonalizeTab.tsx`
 */

import { cn } from '@/utils/cn';
import { useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';
import { buildDesktopSettingsFieldElementId } from '../../../utils/desktopSettingsFieldElementIds';
import {
	applyDesktopUiLanguage,
	normalizeDesktopUiLanguage,
	type DesktopUiLanguage,
} from '../../../utils/applyDesktopUiLanguage';
import type { DesktopSettingsShellHelpers } from '../desktopSettingsShared.types';

const LANGUAGE_OPTIONS: ReadonlyArray<{
	id: DesktopUiLanguage;
	labelKey: string;
}> = [
	{ id: 'ru', labelKey: 'settingsPanel.languageOptionRu' },
	{ id: 'en', labelKey: 'settingsPanel.languageOptionEn' },
];

export type DesktopSettingsPersonalizeLanguageCardProps = {
	shell: DesktopSettingsShellHelpers;
};

export const DesktopSettingsPersonalizeLanguageCard: FC<
	DesktopSettingsPersonalizeLanguageCardProps
> = ({ shell }) => {
	const { t, i18n } = useTranslation('desktopUi');
	const auth = useOptionalAuth();
	const isAuthenticated = Boolean(auth?.isAuthenticated);
	const preferencesApp = useUserPreferencesApp();
	const [busy, setBusy] = useState(false);

	const active = normalizeDesktopUiLanguage(
		i18n.resolvedLanguage ?? i18n.language
	);

	const onSelect = useCallback(
		async (next: DesktopUiLanguage) => {
			if (busy || next === active) return;
			setBusy(true);
			try {
				const result = await applyDesktopUiLanguage(next, {
					persist: Boolean(isAuthenticated),
				});
				if (result.preferences) {
					await preferencesApp?.refresh(result.preferences);
				}
				if (isAuthenticated && !result.persisted) {
					toast.error(t('settingsPanel.languagePersistFailed'));
				}
			} catch {
				toast.error(t('settingsPanel.languageApplyFailed'));
			} finally {
				setBusy(false);
			}
		},
		[active, busy, isAuthenticated, preferencesApp, t]
	);

	return (
		<div
			id={buildDesktopSettingsFieldElementId('profile_ui', 'language')}
			className="flex min-w-0 flex-wrap items-center gap-2.5"
			data-testid="desktop-settings-personalize-language-strip"
		>
			<span
				className={cn(
					DESKTOP_TYPOGRAPHY.captionInherit,
					'shrink-0 font-medium text-(--desktop-text-secondary)'
				)}
				id="desktop-settings-personalize-language-label"
			>
				{t('settingsPanel.languageCardTitle')}
			</span>
			<fieldset
				className={cn(shell.segmentClusterClass, 'min-w-0')}
				data-testid="desktop-settings-personalize-language"
				aria-labelledby="desktop-settings-personalize-language-label"
			>
				<legend className="sr-only">
					{t('settingsPanel.languageCardHint')}
				</legend>
				{LANGUAGE_OPTIONS.map((option) => {
					const selected = active === option.id;
					return (
						<button
							key={option.id}
							type="button"
							aria-pressed={selected}
							disabled={busy}
							data-language={option.id}
							className={cn(
								shell.segmentTabClass(selected),
								DESKTOP_CHROME_FOCUS_VISIBLE,
								busy && 'cursor-wait opacity-70'
							)}
							onClick={() => {
								void onSelect(option.id);
							}}
						>
							{t(option.labelKey)}
						</button>
					);
				})}
			</fieldset>
		</div>
	);
};
