/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile field-mode hub: three large actions for contact log, showings, listing photos.
 *
 * Related:
 * - professionalWorldsFieldMode.ts
 * - OverviewWorkspacePanel.tsx
 */

import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import {
	PROFESSIONAL_WORLDS_FIELD_MODE_ACTIONS,
	resolveFieldModeModuleKey,
} from '../professionalWorldsFieldMode';
import { ProfessionalWorldsWorkspacePanel } from '../layout';
import { isRuntimeModuleEnabled } from '../runtimeModuleMount';

export function FieldModeQuickPanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		activeRuntimeConfig,
		openCommunications,
		openProperties,
		openShowings,
		selectedPropertyId,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();

	return (
		<ProfessionalWorldsWorkspacePanel title={t('fieldMode.title')}>
			<p className="text-xs text-(--desktop-text-secondary)">
				{t('fieldMode.lead')}
			</p>
			<div className="grid gap-2">
				{PROFESSIONAL_WORLDS_FIELD_MODE_ACTIONS.map((action) => {
					const moduleKey = resolveFieldModeModuleKey(action.id);
					const enabled =
						action.id === 'listingPhoto'
							? true
							: moduleKey
								? isRuntimeModuleEnabled(verticalAddonModules, moduleKey)
								: false;
					return (
						<DesktopAppButton
							key={action.id}
							className="justify-start"
							disabled={!enabled}
							onClick={() => {
								if (action.id === 'contact') {
									openCommunications();
									return;
								}
								if (action.id === 'showing' && moduleKey) {
									openShowings(
										selectedPropertyId
											? { propertyId: selectedPropertyId }
											: undefined
									);
									return;
								}
								if (action.id === 'listingPhoto') {
									openProperties({
										propertyId: selectedPropertyId,
										tab: 'listingWorkspace',
										focusMedia: true,
									});
									return;
								}
							}}
						>
							{t(action.labelKey)}
						</DesktopAppButton>
					);
				})}
			</div>
			{activeRuntimeConfig ? null : (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('fieldMode.runtimeLoading')}
				</p>
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}
