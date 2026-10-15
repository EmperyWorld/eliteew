/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Shared constants for marketing-cabinet navigation, query profiles, and list UX thresholds.
 * Navigation keeps stable view ids while grouping the UI in marketer-facing language.
 *
 * Invariants:
 * - MARKETING_SECTION_LIST_FETCH_LIMIT / MARKETING_CONTENT_LIST_FETCH_LIMIT within API max (200).
 * - Grouping must not rename MarketingView ids because deep links and project permissions depend on them.
 *
 * Related:
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import type { ComponentType, SVGProps } from 'react';

import {
	BeakerIcon,
	BuildingLibraryIcon,
	BuildingOffice2Icon,
	ChartBarSquareIcon,
	ChatBubbleLeftRightIcon,
	ClipboardDocumentCheckIcon,
	ClipboardDocumentListIcon,
	CodeBracketIcon,
	DocumentDuplicateIcon,
	ExclamationTriangleIcon,
	FlagIcon,
	LinkIcon,
	MegaphoneIcon,
	ReceiptPercentIcon,
	RectangleStackIcon,
	ShieldCheckIcon,
	SignalIcon,
	SparklesIcon,
	Squares2X2Icon,
	UserGroupIcon,
} from '@heroicons/react/24/outline';

/** Иконки навигации — Heroicons outline (MIT), без `lucide-react`. */
export type MarketingModuleIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type MarketingView =
	| 'overview'
	| 'overview_dashboard'
	| 'companies'
	| 'projects'
	| 'team'
	| 'jtbd'
	| 'value'
	| 'analysis'
	| 'evidence'
	| 'segments'
	| 'campaigns'
	| 'funnel'
	| 'tasks'
	| 'alerts'
	| 'ai_studio'
	| 'amka'
	| 'imc'
	| 'project_rag'
	| 'chat'
	| 'client_interaction';

export type MarketingSidebarGroupId =
	| 'start'
	| 'setup'
	| 'strategy'
	| 'audience'
	| 'growth'
	| 'work'
	| 'materials'
	| 'ai_helpers'
	| 'advanced';

export interface MarketingSidebarGroupDefinition {
	id: MarketingSidebarGroupId;
	viewIds: readonly MarketingView[];
	advanced?: boolean;
}

/** Порядок и иконки разделов; подписи — через i18n (`marketing:modules.<id>`). */
export const MODULE_ORDER: Array<{
	id: MarketingView;
	icon: MarketingModuleIcon;
}> = [
	/** Сетка виджетов; в сайдбаре только если доступен обзор (`overview`). */
	{ id: 'overview_dashboard', icon: Squares2X2Icon },
	{ id: 'overview', icon: ChartBarSquareIcon },
	{ id: 'companies', icon: BuildingOffice2Icon },
	{ id: 'projects', icon: RectangleStackIcon },
	{ id: 'team', icon: UserGroupIcon },
	{ id: 'jtbd', icon: FlagIcon },
	{ id: 'value', icon: ReceiptPercentIcon },
	{ id: 'analysis', icon: ShieldCheckIcon },
	{ id: 'evidence', icon: DocumentDuplicateIcon },
	{ id: 'segments', icon: SignalIcon },
	{ id: 'campaigns', icon: MegaphoneIcon },
	{ id: 'funnel', icon: CodeBracketIcon },
	{ id: 'tasks', icon: ClipboardDocumentCheckIcon },
	{ id: 'alerts', icon: ExclamationTriangleIcon },
	{ id: 'ai_studio', icon: SparklesIcon },
	{ id: 'amka', icon: ClipboardDocumentListIcon },
	{ id: 'imc', icon: BeakerIcon },
	{ id: 'project_rag', icon: BuildingLibraryIcon },
	{ id: 'chat', icon: ChatBubbleLeftRightIcon },
	{ id: 'client_interaction', icon: LinkIcon },
];

export const MARKETING_SIDEBAR_GROUPS: readonly MarketingSidebarGroupDefinition[] =
	[
		{
			id: 'start',
			viewIds: ['overview'],
		},
		{
			id: 'setup',
			viewIds: ['companies', 'projects', 'team'],
		},
		{
			id: 'strategy',
			viewIds: ['jtbd', 'value', 'analysis'],
		},
		{
			id: 'audience',
			viewIds: ['segments'],
		},
		{
			id: 'growth',
			viewIds: ['campaigns', 'funnel'],
		},
		{
			id: 'work',
			viewIds: ['tasks', 'alerts'],
		},
		{
			id: 'materials',
			viewIds: ['evidence', 'client_interaction'],
		},
		{
			id: 'ai_helpers',
			viewIds: ['chat', 'imc', 'amka'],
		},
		{
			id: 'advanced',
			viewIds: ['overview_dashboard', 'ai_studio', 'project_rag'],
			advanced: true,
		},
	] as const;

export function getMarketingSidebarGroupForView(
	view: MarketingView
): MarketingSidebarGroupDefinition | null {
	return (
		MARKETING_SIDEBAR_GROUPS.find((group) => group.viewIds.includes(view)) ??
		null
	);
}

export const PROJECT_ENABLED_MODULES = [
	'jtbd',
	'value_proposition',
	'swot',
	'competitors',
	'researches',
	'content_ai',
	'context_chat',
	'segments',
	'campaigns',
	'funnel',
	'tasks',
	'alerts',
	'ai_studio',
	'amka',
	'imc',
	'imc_research',
	'project_rag',
	'client_interaction',
];

const CABINET_NAV_VIEWS: MarketingView[] = [
	'overview',
	'companies',
	'projects',
];

function marketingViewFromCabinetShellSlug(m: string): MarketingView | null {
	if (m === 'cabinet_overview') return 'overview';
	if (m === 'cabinet_companies') return 'companies';
	if (m === 'cabinet_projects') return 'projects';
	return null;
}

/**
 * Сайдбар по эффективному списку slug’ов с API (`cabinet_modules` или fallback `enabled_modules`):
 * - `undefined/null` => legacy/неизвестно, показываем полный сайдбар
 * - `[]` / только контент без `cabinet_*` => Обзор, Компании, Проекты, Команда (+ контент по slug’ам)
 * - если в списке есть `cabinet_*`, видимость Обзор/Компании/Проекты задаётся ими (права участника)
 */
export function getMarketingSidebarModuleOrder(
	enabledModules: string[] | undefined | null
): typeof MODULE_ORDER {
	if (enabledModules == null) {
		return MODULE_ORDER;
	}
	const allowed = new Set<MarketingView>();
	allowed.add('team');

	const hasExplicitCabinetNav = enabledModules.some((m) =>
		m.startsWith('cabinet_')
	);
	if (!hasExplicitCabinetNav) {
		for (const id of CABINET_NAV_VIEWS) {
			allowed.add(id);
		}
	} else {
		for (const m of enabledModules) {
			const v = marketingViewFromCabinetShellSlug(m);
			if (v) allowed.add(v);
		}
	}

	for (const m of enabledModules) {
		if (m.startsWith('cabinet_')) continue;
		if (m === 'jtbd') allowed.add('jtbd');
		if (m === 'value_proposition') allowed.add('value');
		if (m === 'swot' || m === 'competitors') allowed.add('analysis');
		if (m === 'researches' || m === 'content_ai') allowed.add('evidence');
		if (m === 'segments') allowed.add('segments');
		if (m === 'campaigns') allowed.add('campaigns');
		if (m === 'funnel') allowed.add('funnel');
		if (m === 'tasks') allowed.add('tasks');
		if (m === 'alerts') allowed.add('alerts');
		if (m === 'ai_studio') allowed.add('ai_studio');
		if (m === 'amka') allowed.add('amka');
		if (m === 'imc' || m === 'imc_research') {
			allowed.add('imc');
			allowed.add('project_rag');
		}
		if (m === 'project_rag') allowed.add('project_rag');
		if (m === 'context_chat') allowed.add('chat');
		if (m === 'client_interaction') allowed.add('client_interaction');
	}
	return MODULE_ORDER.filter((row) => {
		if (row.id === 'overview_dashboard') {
			return allowed.has('overview');
		}
		return allowed.has(row.id);
	});
}

/** Раздел сайдбара `imc` открывается, если в проекте есть slug `imc` или `imc_research` (миграции/права могут оставить только один). */
export function projectHasImcCabinetSlug(
	enabledModules: string[] | undefined | null
): boolean {
	if (!enabledModules?.length) return false;
	return enabledModules.some((m) => m === 'imc' || m === 'imc_research');
}

/** Выпадающие списки: `components/MarketingCabinetSelect.tsx`. */

export const TEXTAREA_CLASS =
	'min-h-[112px] w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors focus:border-(--desktop-border-strong) focus:ring-1 focus:ring-(--mc-accent-30)';

export const INPUT_STACK_CLASS = 'grid gap-3 sm:grid-cols-2';

/** Чекбоксы в формах ИМК: `useMarketingShellClasses().checkboxControl` → `getDesktopShellCheckboxControlClassName`. */

/** Максимальный размер списка разделов за один запрос (согласовано с API `le=200`). */
export const MARKETING_SECTION_LIST_FETCH_LIMIT = 200;

/** @deprecated Используйте {@link MARKETING_SECTION_LIST_FETCH_LIMIT}. */
export const MARKETING_CAMPAIGNS_LIST_LIMIT =
	MARKETING_SECTION_LIST_FETCH_LIMIT;

/** Списки разделов выше этого порога рендерятся через `VirtualVariableList`. */
export const MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD = 25;

/** Свернутая строка участника команды (без открытой панели прав). */
export const MARKETING_TEAM_MEMBER_ROW_ESTIMATE_PX = 88;

/** Карточка черновика preview в модалке «Из документа». */
export const MARKETING_AUTOFILL_DRAFT_ROW_ESTIMATE_PX = 240;

/** Карточка сегмента в списке раздела «Сегменты» (виртуальное окно). */
export const MARKETING_SEGMENT_CARD_ESTIMATE_PX = 320;

/** Строка чекбокса в компактном picker формы (JTBD / сегменты). */
export const MARKETING_FORM_CHECKBOX_PICK_ROW_ESTIMATE_PX = 44;

/** Строка каталога RAG в ProjectRagSourcesView (виртуальное окно). */
export const MARKETING_RAG_CATALOG_ROW_ESTIMATE_PX = 72;

/** TanStack Query key для `listProjectContent` в кабинете. */
export function marketingCabinetContentQueryKey(
	projectId: string | null | undefined,
	companyId?: string | null
): readonly unknown[] {
	return [
		'content',
		'marketing',
		projectId ?? null,
		companyId ?? null,
		MARKETING_CONTENT_LIST_FETCH_LIMIT,
	];
}

/**
 * Лимит документов проекта в кабинете (`GET /api/content`, compact list).
 * Ниже полного API max (200), чтобы не тянуть тяжёлый каталог на обзор/доказательства.
 */
export const MARKETING_CONTENT_LIST_FETCH_LIMIT = 80;

/** Компании / проекты в навигации кабинета (`GET /companies`, `GET /projects`). */
export const MARKETING_FOUNDATION_LIST_FETCH_LIMIT = 200;

/** TanStack Query key для `listProjects` по компании (foundation + scope checks). */
export function marketingCabinetFoundationProjectsQueryKey(
	companyId: string | null | undefined
): readonly unknown[] {
	return [
		'marketing',
		'projects',
		companyId ?? null,
		MARKETING_FOUNDATION_LIST_FETCH_LIMIT,
	];
}

/** Участники проекта (`GET /projects/{id}/members`, max 200 на API). */
export const MARKETING_PROJECT_MEMBERS_FETCH_LIMIT = 200;

/** История AI runs в панели AI Studio (не путать с rail poll limit 80). */
export const MARKETING_AI_RUNS_PANEL_LIMIT = 50;

/** Rail/badge: минимальный `limit` для company-scope list (счётчик берётся из `total`). */
export const MARKETING_RAIL_ACTIVE_RUNS_LIMIT = 1;

/**
 * «Живой» профиль запросов: короткий staleTime, без нулевого gcTime —
 * меньше refetch-шторма при переключении вкладок, данные всё ещё обновляются на focus/reconnect.
 */
export const MARKETING_LIVE_QUERY_OPTIONS = {
	staleTime: 15_000,
	gcTime: 5 * 60_000,
	structuralSharing: true,
	refetchOnMount: true,
	refetchOnWindowFocus: true,
	refetchOnReconnect: true,
	/** Inline error UI в секциях; без дублирующего глобального toast из QueryProvider. */
	meta: { showErrorToast: false },
} as const;

/** Виды, где нужен активный layout дашборда (series / layout_id). */
export const MARKETING_DASHBOARD_LAYOUT_QUERY_VIEWS = [
	'overview',
	'overview_dashboard',
] as const satisfies readonly MarketingView[];
