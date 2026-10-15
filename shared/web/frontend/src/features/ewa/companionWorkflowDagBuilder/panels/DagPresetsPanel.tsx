/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Preset gallery for loading starter DAG workflow chains in the visual builder.
 *
 * Related:
 * - registry/dagWorkflowPresets.ts
 * - presets/loadWorkflowPreset.ts
 */

import { COMPANION_DAG_WORKFLOW_PRESETS } from '@/features/ewa/companionWorkflowDagBuilder/registry/dagWorkflowPresets';
import type { DagWorkflowPresetId } from '@/features/ewa/companionWorkflowDagBuilder/registry/dagWorkflowPresets';
import { useTranslation } from 'react-i18next';
import {
	COMPANION_DAG_BUILDER_LABEL_CLASS,
	COMPANION_DAG_BUILDER_PANEL_CLASS,
} from '@/features/ewa/companionWorkflowDagBuilder/dagBuilderUi';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Props = {
	disabled?: boolean;
	onLoadPreset: (presetId: DagWorkflowPresetId) => void;
};

export function DagPresetsPanel({ disabled = false, onLoadPreset }: Props) {
	const { i18n, t } = useTranslation('marketing');
	const isRu = i18n.language.startsWith('ru');

	return (
		<section
			className={cn(COMPANION_DAG_BUILDER_PANEL_CLASS, 'flex flex-col gap-3')}
		>
			<div>
				<div className="text-xs font-semibold uppercase tracking-wide text-(--companion-text-soft)">
					{t('ewaCompanion.workflowDag.presetsTitle')}
				</div>
				<p
					className={cn(COMPANION_DAG_BUILDER_LABEL_CLASS, 'mt-1 normal-case')}
				>
					{t('ewaCompanion.workflowDag.presetsHint')}
				</p>
			</div>
			<ul className="flex flex-col gap-2">
				{COMPANION_DAG_WORKFLOW_PRESETS.map((preset) => (
					<li
						key={preset.id}
						className="rounded-md border border-(--companion-divider) bg-(--desktop-surface-soft) p-2.5"
					>
						<div className="text-[13px] font-medium text-(--desktop-text-primary)">
							{isRu ? preset.titleRu : preset.titleEn}
						</div>
						<p className="mt-1 text-[11px] leading-snug text-(--companion-text-soft)">
							{isRu ? preset.descriptionRu : preset.descriptionEn}
						</p>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="mt-2 w-full justify-center"
							disabled={disabled}
							onClick={() => onLoadPreset(preset.id)}
						>
							{t('ewaCompanion.workflowDag.loadPreset')}
						</DesktopAppButton>
					</li>
				))}
			</ul>
		</section>
	);
}
