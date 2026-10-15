/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared runtime-guardrail logic for KIRS operator console actions.
 * Keeps action availability and next-step hints deterministic across UI states.
 *
 * Invariants:
 * - Pending transitions always disable runtime actions.
 * - `canStart` is true only for existing instance in non-running non-pending state.
 * - Hint priority is stable: pending -> offline/start -> API -> publish -> public health -> ready.
 *
 * Related:
 * - `pages/Kirs/KirsPage.tsx`
 * - `documentation/product/KIRS-SITE-CURATION.md`
 */

const KIRS_PENDING_STATUSES = new Set([
	'provisioning',
	'starting',
	'redeploying',
	'stopping',
]);

const KIRS_RUNNING_STATUSES = new Set(['running']);

export interface KirsRuntimeUiInput {
	status?: string | null;
	healthStatus?: string | null;
	apiOk: boolean;
	publicOk: boolean;
	publicationState?: string | null;
	hasInstance: boolean;
	busy: boolean;
}

export interface KirsRuntimeUiState {
	status: string;
	isPending: boolean;
	isRunning: boolean;
	apiOk: boolean;
	publicOk: boolean;
	isPublished: boolean;
	canProvision: boolean;
	canStart: boolean;
	canStop: boolean;
	canRedeploy: boolean;
	provisionTitle: string;
	startTitle: string;
	stopTitle: string;
	redeployTitle: string;
	disabledActionHints: string[];
	nextStepHint: string;
}

function normalizeStatus(status: string | null | undefined): string {
	return String(status ?? '')
		.trim()
		.toLowerCase();
}

function isKirsRunningStatus(status: string | null | undefined): boolean {
	return KIRS_RUNNING_STATUSES.has(normalizeStatus(status));
}

export function isKirsPendingStatus(
	status: string | null | undefined
): boolean {
	return KIRS_PENDING_STATUSES.has(normalizeStatus(status));
}

function getKirsNextStepHint(params: {
	hasInstance: boolean;
	status: string;
	isPending: boolean;
	isRunning: boolean;
	apiOk: boolean;
	isPublished: boolean;
	publicOk: boolean;
}): string {
	const {
		hasInstance,
		status,
		isPending,
		isRunning,
		apiOk,
		isPublished,
		publicOk,
	} = params;

	if (!hasInstance) {
		return 'Сначала создайте инстанс сайта для проекта.';
	}
	if (isPending) {
		return 'Операция выполняется. Дождитесь завершения и обновления статуса.';
	}
	if (!isRunning && (status === 'draft' || status === 'stopped')) {
		return 'Следующий шаг: подготовить сайт и затем запустить его.';
	}
	if (!isRunning) {
		return 'Сайт сейчас не запущен. Запустите его для проверки витрины и админки.';
	}
	if (!apiOk) {
		return 'Runtime запущен, но API недоступен. Проверьте health и выполните «Обновить сайт».';
	}
	if (!isPublished) {
		return 'Сайт работает, но закрыт для посетителей. Откройте доступ кнопкой «Открыть сайт для посетителей».';
	}
	if (!publicOk) {
		return 'Публикация включена, но публичная проверка не пройдена. Проверьте домен и health.';
	}
	return 'Сайт в рабочем состоянии: можно открыть витрину и админку.';
}

export function computeKirsRuntimeUi(
	input: KirsRuntimeUiInput
): KirsRuntimeUiState {
	const status = normalizeStatus(input.status);
	const healthStatus = normalizeStatus(input.healthStatus);
	const isPending =
		isKirsPendingStatus(status) || isKirsPendingStatus(healthStatus);
	const isRunning =
		isKirsRunningStatus(status) || isKirsRunningStatus(healthStatus);
	const isPublished = normalizeStatus(input.publicationState) === 'open';

	const canProvision = input.hasInstance && !input.busy && !isPending;
	const canStart = input.hasInstance && !input.busy && !isPending && !isRunning;
	const canStop = input.hasInstance && !input.busy && !isPending && isRunning;
	const canRedeploy =
		input.hasInstance && !input.busy && !isPending && isRunning;
	const operationInProgressReason =
		'Операция уже выполняется. Дождитесь завершения.';
	const noInstanceReason = 'Сначала создайте инстанс сайта для проекта.';

	const provisionBlockedReason = !input.hasInstance
		? noInstanceReason
		: input.busy || isPending
			? operationInProgressReason
			: null;
	const startBlockedReason = !input.hasInstance
		? noInstanceReason
		: input.busy || isPending
			? operationInProgressReason
			: isRunning
				? 'Сайт уже запущен.'
				: null;
	const stopBlockedReason = !input.hasInstance
		? noInstanceReason
		: input.busy || isPending
			? operationInProgressReason
			: !isRunning
				? 'Сайт уже остановлен.'
				: null;
	const redeployBlockedReason = !input.hasInstance
		? noInstanceReason
		: input.busy || isPending
			? operationInProgressReason
			: !isRunning
				? 'Сначала запустите сайт, затем обновляйте его.'
				: null;
	const disabledActionHints = [
		provisionBlockedReason
			? `Подготовить сайт: ${provisionBlockedReason}`
			: null,
		startBlockedReason ? `Запустить сайт: ${startBlockedReason}` : null,
		stopBlockedReason ? `Поставить на паузу: ${stopBlockedReason}` : null,
		redeployBlockedReason ? `Обновить сайт: ${redeployBlockedReason}` : null,
	].filter((item): item is string => Boolean(item));

	return {
		status,
		isPending,
		isRunning,
		apiOk: input.apiOk,
		publicOk: input.publicOk,
		isPublished,
		canProvision,
		canStart,
		canStop,
		canRedeploy,
		provisionTitle:
			provisionBlockedReason ??
			'Подготовит сайт к запуску: соберёт нужные части и проверит базовое состояние.',
		startTitle:
			startBlockedReason ??
			'Запускает сайт для работы. Используйте, если сайт сейчас остановлен.',
		stopTitle:
			stopBlockedReason ??
			'Временно ставит сайт на паузу. Данные сохраняются, но витрина становится недоступной.',
		redeployTitle:
			redeployBlockedReason ??
			'Перезапускает сайт и применяет последние изменения, если что-то отображается некорректно.',
		disabledActionHints,
		nextStepHint: getKirsNextStepHint({
			hasInstance: input.hasInstance,
			status,
			isPending,
			isRunning,
			apiOk: input.apiOk,
			isPublished,
			publicOk: input.publicOk,
		}),
	};
}
