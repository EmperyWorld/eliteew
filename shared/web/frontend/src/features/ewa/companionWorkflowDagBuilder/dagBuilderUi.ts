/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Solid, opaque panel tokens for the companion DAG visual builder (no ghost overlays).
 *
 * Invariants:
 * - DAG builder panels use these classes instead of translucent surface tokens.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 */

export const COMPANION_DAG_BUILDER_PANEL_CLASS =
	'rounded-lg border border-(--companion-divider) bg-(--desktop-surface-elevated) p-3 shadow-sm';

export const COMPANION_DAG_BUILDER_POPOVER_CLASS =
	'rounded-xl border border-(--companion-divider) bg-(--desktop-surface-elevated) p-2 shadow-lg';

export const COMPANION_DAG_BUILDER_FIELD_CLASS =
	'rounded-md border border-(--companion-divider) bg-(--desktop-surface-soft) px-2.5 py-1.5 text-[13px] text-(--desktop-text-primary) placeholder:text-(--companion-text-soft)';

export const COMPANION_DAG_BUILDER_LABEL_CLASS =
	'text-[11px] font-medium text-(--companion-text-soft)';

export const COMPANION_DAG_BUILDER_NESTED_SECTION_CLASS =
	'rounded-md border border-(--companion-divider) bg-(--desktop-surface-soft) p-2.5';

export const COMPANION_DAG_CATEGORY_LABELS_RU: Record<string, string> = {
	generate: 'Генерация',
	control: 'Управление',
	branch: 'Ветвление',
	loop: 'Циклы',
	integrate: 'Интеграции',
	outbound: 'Исходящие',
	ai: 'ИИ',
};
