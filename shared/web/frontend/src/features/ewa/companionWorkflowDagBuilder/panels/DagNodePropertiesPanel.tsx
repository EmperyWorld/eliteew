/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context-aware node properties inspector driven by ``fieldSchemas.ts``.
 *
 * Related:
 * - DagInspectorPanel.tsx
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PlaceholderInputField } from '@/features/ewa/companionWorkflowDagBuilder/panels/PlaceholderInputField';
import {
	fieldsBySection,
	type FieldSection,
	type SchemaField,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/fieldSchemas';
import {
	useDagBuilderEditor,
	useSelectedNode,
} from '@/features/ewa/companionWorkflowDagBuilder/state/DagBuilderEditorContext';
import { COMPANION_DAG_BUILDER_NESTED_SECTION_CLASS } from '@/features/ewa/companionWorkflowDagBuilder/dagBuilderUi';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import {
	fetchCompanionUserWorkflowToolCatalog,
	type CompanionUserWorkflowToolCatalogEntry,
} from '@/services/ewa/companionUserWorkflowsApi';
import { mergeCompanionUserWorkflowToolCatalog } from '@/services/ewa/companionUserWorkflowToolCatalogFallback';
import { cn } from '@/utils/cn';

const SECTION_LABELS: Record<FieldSection, { ru: string; en: string }> = {
	meta: { ru: 'Идентификация', en: 'Identity' },
	mode: { ru: 'Режим', en: 'Mode' },
	config: { ru: 'Конфигурация', en: 'Configuration' },
	inputs: { ru: 'Входы', en: 'Inputs' },
	on_error: { ru: 'Ошибки', en: 'On error' },
};

function readConfigValue(
	node: ReturnType<typeof useSelectedNode>,
	key: string
): string {
	if (!node) return '';
	const config = node.config ?? {};
	const value = config[key as keyof typeof config];
	if (value === null || value === undefined) return '';
	return String(value);
}

function readInputValue(
	node: ReturnType<typeof useSelectedNode>,
	key: string
): string {
	if (!node) return '';
	const value = node.inputs?.[key];
	if (value === null || value === undefined) return '';
	return String(value);
}

function readOnErrorValue(
	node: ReturnType<typeof useSelectedNode>,
	key: string
): string {
	if (!node) return '';
	const onError = node.on_error ?? {};
	const value = onError[key as keyof typeof onError];
	if (value === null || value === undefined) return '';
	return String(value);
}

export function DagNodePropertiesPanel() {
	const { i18n, t } = useTranslation('marketing');
	const isRu = i18n.language.startsWith('ru');
	const node = useSelectedNode();
	const { patchNode, onNodeTitleChange } = useDagBuilderEditor();
	const [toolCatalog, setToolCatalog] = useState<
		CompanionUserWorkflowToolCatalogEntry[]
	>(() => mergeCompanionUserWorkflowToolCatalog(null).catalog);

	useEffect(() => {
		let cancelled = false;
		void fetchCompanionUserWorkflowToolCatalog()
			.then((server) => {
				if (!cancelled) {
					setToolCatalog(mergeCompanionUserWorkflowToolCatalog(server).catalog);
				}
			})
			.catch((error) => {
				ewaCompanionDegradeDebug(
					'dag_builder_tool_catalog',
					'fallback_catalog',
					error
				);
				if (!cancelled) {
					setToolCatalog(mergeCompanionUserWorkflowToolCatalog(null).catalog);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (!node) {
		return (
			<p className="text-xs text-(--companion-text-soft)">
				{isRu ? 'Выберите узел на холсте.' : 'Select a node on the canvas.'}
			</p>
		);
	}

	const grouped = fieldsBySection(node.type);

	const renderField = (field: SchemaField) => {
		const label = isRu ? field.labelRu : field.labelEn;

		if (field.section === 'meta') {
			const value =
				field.key === 'title_ru'
					? (node.title_ru ?? '')
					: (node.title_en ?? '');
			return (
				<PlaceholderInputField
					key={field.key}
					label={label}
					value={value}
					onChange={(next) => {
						patchNode(node.id, {
							[field.key]: next,
						} as Partial<typeof node>);
						if (field.key === 'title_ru') {
							onNodeTitleChange(node.id, next);
						}
					}}
					pickerAnchor={{
						kind: 'node_input',
						nodeId: node.id,
						inputKey: field.key,
					}}
				/>
			);
		}

		if (field.section === 'mode') {
			return (
				<label key={field.key} className="flex flex-col gap-1">
					<span className="text-xs font-medium text-(--companion-text-soft)">
						{label}
					</span>
					<select
						className="rounded-lg border border-(--companion-border-subtle) bg-(--companion-surface-soft)/40 px-2 py-1.5 text-sm"
						value={node.mode ?? 'stateful'}
						onChange={(event) =>
							patchNode(node.id, {
								mode: event.target.value as 'stateful' | 'stateless',
							})
						}
					>
						{(field.options ?? []).map((option) => (
							<option key={option.value} value={option.value}>
								{isRu ? option.labelRu : option.labelEn}
							</option>
						))}
					</select>
				</label>
			);
		}

		if (field.section === 'config') {
			if (node.type === 'api_call' && field.key === 'tool_name') {
				return (
					<label key={field.key} className="flex flex-col gap-1">
						<span className="text-xs font-medium text-(--companion-text-soft)">
							{label}
						</span>
						<select
							className="rounded-lg border border-(--companion-border-subtle) bg-(--companion-surface-soft)/40 px-2 py-1.5 text-sm"
							value={readConfigValue(node, field.key)}
							onChange={(event) =>
								patchNode(node.id, {
									config: { tool_name: event.target.value },
								})
							}
						>
							<option value="">
								{t('ewaCompanion.workflowDag.chooseTool')}
							</option>
							{toolCatalog.map((tool) => (
								<option key={tool.name} value={tool.name}>
									{isRu ? tool.title_ru : tool.title_en}
								</option>
							))}
						</select>
					</label>
				);
			}
			if (field.placeholderSupport) {
				return (
					<PlaceholderInputField
						key={field.key}
						label={label}
						value={readConfigValue(node, field.key)}
						multiline={field.kind === 'textarea'}
						onChange={(next) =>
							patchNode(node.id, { config: { [field.key]: next } })
						}
						pickerAnchor={{
							kind: 'node_config',
							nodeId: node.id,
							configKey: field.key,
						}}
					/>
				);
			}
			if (field.kind === 'select') {
				return (
					<label key={field.key} className="flex flex-col gap-1">
						<span className="text-xs font-medium text-(--companion-text-soft)">
							{label}
						</span>
						<select
							className="rounded-lg border border-(--companion-border-subtle) bg-(--companion-surface-soft)/40 px-2 py-1.5 text-sm"
							value={readConfigValue(node, field.key)}
							onChange={(event) =>
								patchNode(node.id, {
									config: { [field.key]: event.target.value },
								})
							}
						>
							{(field.options ?? []).map((option) => (
								<option key={option.value} value={option.value}>
									{isRu ? option.labelRu : option.labelEn}
								</option>
							))}
						</select>
					</label>
				);
			}
			return (
				<PlaceholderInputField
					key={field.key}
					label={label}
					value={readConfigValue(node, field.key)}
					onChange={(next) =>
						patchNode(node.id, {
							config: {
								[field.key]: field.kind === 'number' ? Number(next) || 0 : next,
							},
						})
					}
					pickerAnchor={{
						kind: 'node_config',
						nodeId: node.id,
						configKey: field.key,
					}}
				/>
			);
		}

		if (field.section === 'inputs') {
			return (
				<PlaceholderInputField
					key={field.key}
					label={label}
					value={readInputValue(node, field.key)}
					multiline={field.kind === 'textarea'}
					onChange={(next) =>
						patchNode(node.id, { inputs: { [field.key]: next } })
					}
					pickerAnchor={{
						kind: 'node_input',
						nodeId: node.id,
						inputKey: field.key,
					}}
				/>
			);
		}

		if (field.section === 'on_error') {
			if (field.kind === 'select') {
				return (
					<label key={field.key} className="flex flex-col gap-1">
						<span className="text-xs font-medium text-(--companion-text-soft)">
							{label}
						</span>
						<select
							className="rounded-lg border border-(--companion-border-subtle) bg-(--companion-surface-soft)/40 px-2 py-1.5 text-sm"
							value={readOnErrorValue(node, field.key) || 'stop'}
							onChange={(event) =>
								patchNode(node.id, {
									on_error: { [field.key]: event.target.value },
								})
							}
						>
							{(field.options ?? []).map((option) => (
								<option key={option.value} value={option.value}>
									{isRu ? option.labelRu : option.labelEn}
								</option>
							))}
						</select>
					</label>
				);
			}
			return (
				<PlaceholderInputField
					key={field.key}
					label={label}
					value={readOnErrorValue(node, field.key)}
					onChange={(next) =>
						patchNode(node.id, {
							on_error: { [field.key]: Number(next) || 1 },
						})
					}
					pickerAnchor={{
						kind: 'node_config',
						nodeId: node.id,
						configKey: field.key,
					}}
				/>
			);
		}

		return null;
	};

	return (
		<div className="flex flex-col gap-3">
			<div>
				<div className="text-sm font-semibold text-(--companion-text-primary)">
					{node.title_ru || node.title_en || node.type}
				</div>
				<div className="text-[10px] uppercase text-(--companion-text-soft)">
					{node.type}
				</div>
			</div>
			{(Object.keys(grouped) as FieldSection[]).map((section) => {
				const fields = grouped[section];
				if (fields.length === 0) return null;
				const sectionLabel = isRu
					? SECTION_LABELS[section].ru
					: SECTION_LABELS[section].en;
				return (
					<div
						key={section}
						className={cn(COMPANION_DAG_BUILDER_NESTED_SECTION_CLASS, 'gap-2')}
					>
						<div className="text-[10px] font-semibold uppercase tracking-wide text-(--companion-aura)/90">
							{sectionLabel}
						</div>
						<div className="flex flex-col gap-2">{fields.map(renderField)}</div>
					</div>
				);
			})}
			{node.type === 'switch' ? (
				<div
					className={cn(COMPANION_DAG_BUILDER_NESTED_SECTION_CLASS, 'gap-2')}
				>
					<div className="text-[10px] font-semibold uppercase tracking-wide text-(--companion-aura)/90">
						switch_cases (JSON)
					</div>
					<textarea
						className="min-h-28 w-full rounded-lg border border-(--companion-border-subtle) bg-(--companion-surface-soft)/40 px-2 py-1.5 font-mono text-xs"
						value={JSON.stringify(node.config?.switch_cases ?? [], null, 2)}
						onChange={(event) => {
							try {
								const parsed = JSON.parse(event.target.value) as unknown;
								if (!Array.isArray(parsed)) return;
								patchNode(node.id, { config: { switch_cases: parsed } });
							} catch {
								// Keep editing until JSON is valid.
							}
						}}
						spellCheck={false}
					/>
					<p className="text-[10px] text-(--companion-text-soft)">
						{isRu
							? 'Пример: [{"branch":"a","op":"eq","value":"x","source":"text"}]'
							: 'Example: [{"branch":"a","op":"eq","value":"x","source":"text"}]'}
					</p>
				</div>
			) : null}
		</div>
	);
}
