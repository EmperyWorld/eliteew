/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared placeholder panel for runtime modules while vertical-specific panels are split out.
 *
 * Invariants:
 * - Does not perform data loading; the runtime shell owns snapshot fetching.
 * - Keeps missing or not-yet-extracted module panels visible instead of failing silently.
 * - Copy resolves through `professionalWorlds.runtime.placeholder` for the configured UI language.
 *
 * Related:
 * - ../runtimeModuleRegistry.tsx
 * - ../ProfessionalWorldsApp.tsx
 */

import { DesktopAppEmptyState } from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { useTranslation } from 'react-i18next';

import type { RuntimeModulePanelProps } from '../runtimeModuleRegistry';

function resolvePlaceholderModuleLabel(
	t: ReturnType<typeof useTranslation>['t'],
	entry: RuntimeModulePanelProps['entry'],
	runtimeModule: RuntimeModulePanelProps['runtimeModule']
): string {
	const runtimeName = runtimeModule?.module_name?.trim();
	if (runtimeName) {
		return runtimeName;
	}
	const labelKey = `runtime.placeholder.moduleLabels.${entry.moduleKey}`;
	const localized = t(labelKey);
	return localized === labelKey ? entry.label : localized;
}

export default function RuntimePlaceholderPanel({
	entry,
	runtimeModule,
	verticalSlug,
}: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const moduleLabel = resolvePlaceholderModuleLabel(t, entry, runtimeModule);

	return (
		<DesktopAppEmptyState
			title={t('runtime.placeholder.title')}
			description={t('runtime.placeholder.description')}
		>
			{moduleLabel ? (
				<span className="text-xs text-(--desktop-text-muted)">
					{t('runtime.placeholder.moduleHint', {
						module: moduleLabel,
						vertical: verticalSlug,
					})}
				</span>
			) : null}
			<span className="mt-3 block max-w-md text-xs text-(--desktop-text-muted)">
				{t('runtime.placeholder.clientsHint')}
			</span>
			<div className="mt-3 grid max-w-md gap-1 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 text-left text-xs text-(--desktop-text-secondary)">
				<strong className="text-(--desktop-text-primary)">
					{t('runtime.placeholder.availableNowTitle')}
				</strong>
				<span>{t('runtime.placeholder.availableNowProfile')}</span>
				<span>{t('runtime.placeholder.availableNowObjects')}</span>
				<span>{t('runtime.placeholder.availableNowArtifacts')}</span>
			</div>
		</DesktopAppEmptyState>
	);
}
