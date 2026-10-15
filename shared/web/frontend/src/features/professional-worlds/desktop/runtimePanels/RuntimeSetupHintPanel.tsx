/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * First-run hint when catalog verticals exist but no runtime pack is activated yet.
 *
 * Invariants:
 * - Shown only when `runtimeConfigs` is empty and `verticals` is non-empty (parent gates).
 * - Uses visible hero + trust note; numbered steps stay in progressive disclosure.
 *
 * Related:
 * - ProfessionalWorldsWorkspaceSection.tsx
 */

import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
} from '../layout';

export function RuntimeSetupHintPanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	return (
		<ProfessionalWorldsWorkspaceSection title={t('runtime.setupTitle')}>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('runtime.setupVisible.eyebrow')}
				title={t('runtime.setupVisible.title')}
				description={t('runtime.setupVisible.description')}
			/>
			<ProfessionalWorldsTrustNote title={t('runtime.setupVisible.trustTitle')}>
				{t('runtime.setupVisible.trustBody')}
			</ProfessionalWorldsTrustNote>
			<ProfessionalWorldsWorkspacePanel>
				<ol className="list-decimal space-y-2 pl-5 text-sm text-(--desktop-text-secondary)">
					<li>{t('runtime.setupStep1')}</li>
					<li>{t('runtime.setupStep2')}</li>
					<li>{t('runtime.setupStep3')}</li>
				</ol>
			</ProfessionalWorldsWorkspacePanel>
		</ProfessionalWorldsWorkspaceSection>
	);
}
