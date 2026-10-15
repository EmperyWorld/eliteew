/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft Config editor — Lanes tab (UGS workflow, sampler, default lane).
 *
 * Invariants:
 * - PATCH only when isDraft; active/retired are read-only.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/musicForge/MusicForgeConfigEditor.tsx`
 * - `documentation/product/MUSIC-FORGE-APP.md`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import { AdminButton } from '../ui';
import {
	MUSIC_FORGE_UGS_WORKFLOW_META,
	MUSIC_FORGE_UGS_WORKFLOWS,
	patchMusicForgeAdminConfigLane,
} from './musicForgeAdminApi';
import {
	FieldLabel,
	adminUiMetaClass,
	asRecord,
	boolField,
	musicForgeConfigInputClass,
	strField,
} from './musicForgeConfigEditorShared';

export interface MusicForgeConfigLanePanelProps {
	revisionId: string;
	isDraft: boolean;
	lanes: Record<string, unknown>;
	laneKey: string;
	onLaneKeyChange: (key: string) => void;
	onSaved: () => Promise<void>;
	onError: (message: string) => void;
	onMessage: (message: string) => void;
}

export function MusicForgeConfigLanePanel({
	revisionId,
	isDraft,
	lanes,
	laneKey,
	onLaneKeyChange,
	onSaved,
	onError,
	onMessage,
}: MusicForgeConfigLanePanelProps): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi');
	const workflowLabel = React.useCallback(
		(w: (typeof MUSIC_FORGE_UGS_WORKFLOWS)[number]) => {
			const meta = MUSIC_FORGE_UGS_WORKFLOW_META[w];
			const title =
				i18n.language?.startsWith('ru') ? meta.labelRu : meta.labelEn;
			return `${w} — ${title} (${meta.workflowFile})`;
		},
		[i18n.language]
	);
	const [saving, setSaving] = React.useState(false);
	const [ugsWorkflow, setUgsWorkflow] = React.useState('v4');
	const [workflowFile, setWorkflowFile] = React.useState('');
	const [aceWorkflow, setAceWorkflow] = React.useState('');
	const [modelScope, setModelScope] = React.useState('');
	const [billingMode, setBillingMode] = React.useState('');
	const [isDefault, setIsDefault] = React.useState(false);
	const [ksamplerTemplate, setKsamplerTemplate] = React.useState(false);
	const [samplerCfg, setSamplerCfg] = React.useState('7');
	const [samplerSteps, setSamplerSteps] = React.useState('50');
	const [samplerName, setSamplerName] = React.useState('jkass_quality');
	const [samplerScheduler, setSamplerScheduler] = React.useState('');

	React.useEffect(() => {
		if (!laneKey) return;
		const lane = asRecord(lanes[laneKey]);
		setUgsWorkflow(strField(lane, 'ugs_workflow', 'v4'));
		setWorkflowFile(strField(lane, 'workflow_file'));
		setAceWorkflow(strField(lane, 'ace_workflow'));
		setModelScope(strField(lane, 'model_scope'));
		setBillingMode(strField(lane, 'billing_mode'));
		setIsDefault(boolField(lane, 'is_default'));
		setKsamplerTemplate(boolField(lane, 'ksampler_use_comfy_template'));
		const sampler = asRecord(lane.sampler);
		setSamplerCfg(String(sampler.cfg ?? 7));
		setSamplerSteps(String(sampler.steps ?? 50));
		setSamplerName(strField(sampler, 'sampler_name', 'jkass_quality'));
		setSamplerScheduler(strField(sampler, 'scheduler'));
	}, [lanes, laneKey]);

	const saveLane = async () => {
		if (!isDraft || !laneKey) return;
		setSaving(true);
		try {
			const sampler: Record<string, unknown> = {
				cfg: Number(samplerCfg),
				steps: Number(samplerSteps),
				sampler_name: samplerName.trim(),
			};
			if (samplerScheduler.trim()) {
				sampler.scheduler = samplerScheduler.trim();
			}
			await patchMusicForgeAdminConfigLane(revisionId, laneKey, {
				ugs_workflow: ugsWorkflow,
				workflow_file: workflowFile.trim(),
				ace_workflow: aceWorkflow.trim() || undefined,
				model_scope: modelScope.trim() || undefined,
				billing_mode: billingMode.trim() || undefined,
				ksampler_use_comfy_template: ksamplerTemplate,
				is_default: isDefault,
				sampler,
			});
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onSaved();
		} catch (err) {
			log.error(
				'MusicForgeConfigLanePanel',
				'lane save failed',
				err instanceof Error ? err : undefined
			);
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	const inputClass = musicForgeConfigInputClass;

	return (
		<div className="space-y-3 rounded-xl border border-white/10 bg-white/2 p-4">
			<div>
				<FieldLabel>{t('adminMusicForge.configEditorLaneKey')}</FieldLabel>
				<select
					className={inputClass}
					value={laneKey}
					onChange={(e) => onLaneKeyChange(e.target.value)}
				>
					{Object.keys(lanes).map((key) => (
						<option key={key} value={key}>
							{key}
						</option>
					))}
				</select>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="sm:col-span-2">
					<p className={adminUiMetaClass}>
						{t('adminMusicForge.configEditorLanesHint')}
					</p>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorUgsWorkflow')}
					</FieldLabel>
					<select
						className={inputClass}
						value={ugsWorkflow}
						disabled={!isDraft}
						onChange={(e) => {
							const next = e.target.value;
							setUgsWorkflow(next);
							const meta =
								MUSIC_FORGE_UGS_WORKFLOW_META[
									next as (typeof MUSIC_FORGE_UGS_WORKFLOWS)[number]
								];
							if (meta?.workflowFile) {
								setWorkflowFile(meta.workflowFile);
							}
						}}
					>
						{MUSIC_FORGE_UGS_WORKFLOWS.map((w) => (
							<option key={w} value={w}>
								{workflowLabel(w)}
							</option>
						))}
					</select>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorWorkflowFile')}
					</FieldLabel>
					<input
						className={inputClass}
						value={workflowFile}
						disabled={!isDraft}
						onChange={(e) => setWorkflowFile(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorAceWorkflow')}
					</FieldLabel>
					<input
						className={inputClass}
						value={aceWorkflow}
						disabled={!isDraft}
						onChange={(e) => setAceWorkflow(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>{t('adminMusicForge.configEditorModelScope')}</FieldLabel>
					<input
						className={inputClass}
						value={modelScope}
						disabled={!isDraft}
						onChange={(e) => setModelScope(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorBillingMode')}
					</FieldLabel>
					<input
						className={inputClass}
						value={billingMode}
						disabled={!isDraft}
						onChange={(e) => setBillingMode(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>{t('adminMusicForge.configEditorSamplerCfg')}</FieldLabel>
					<input
						className={inputClass}
						value={samplerCfg}
						disabled={!isDraft}
						onChange={(e) => setSamplerCfg(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorSamplerSteps')}
					</FieldLabel>
					<input
						className={inputClass}
						value={samplerSteps}
						disabled={!isDraft}
						onChange={(e) => setSamplerSteps(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorSamplerName')}
					</FieldLabel>
					<input
						className={inputClass}
						value={samplerName}
						disabled={!isDraft}
						onChange={(e) => setSamplerName(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorSamplerScheduler')}
					</FieldLabel>
					<input
						className={inputClass}
						value={samplerScheduler}
						disabled={!isDraft}
						onChange={(e) => setSamplerScheduler(e.target.value)}
					/>
				</div>
			</div>
			<label className="flex items-center gap-2 text-sm text-slate-200">
				<input
					type="checkbox"
					checked={isDefault}
					disabled={!isDraft}
					onChange={(e) => setIsDefault(e.target.checked)}
				/>
				{t('adminMusicForge.configEditorIsDefault')}
			</label>
			<label className="flex items-center gap-2 text-sm text-slate-200">
				<input
					type="checkbox"
					checked={ksamplerTemplate}
					disabled={!isDraft}
					onChange={(e) => setKsamplerTemplate(e.target.checked)}
				/>
				{t('adminMusicForge.configEditorKsamplerTemplate')}
			</label>
			{isDraft ? (
				<AdminButton
					variant="primary"
					disabled={saving}
					onClick={() => void saveLane()}
				>
					{saving
						? t('adminMusicForge.configEditorSaving')
						: t('adminMusicForge.configEditorSaveLane')}
				</AdminButton>
			) : null}
		</div>
	);
}
