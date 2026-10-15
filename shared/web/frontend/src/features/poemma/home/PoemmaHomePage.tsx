/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner business map home (`/`) with wave-6 map tiles, shared progress bars, contrast-safe surfaces.
 *
 * Invariants:
 * - No fake charts or placeholder profit numbers on block A.
 * - Team role hides blocks A and D; reduced map shows alignment, experience, guide.
 * - Data loads through repository, not direct localStorage.
 * - Loading/error states are explicit (no silent fallback).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframe-home.md §5–§9
 */

import { useEffect, useMemo, useState } from 'react';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type {
	PoemmaChannel,
	PoemmaCustomerSegment,
	PoemmaExperienceBalance,
	PoemmaFinanceSnapshot,
	PoemmaInitiative,
	PoemmaNpsSnapshot,
	PoemmaPeriod,
	PoemmaPeriodGoal,
	PoemmaPromotionAction,
	PoemmaStrategyAnchor,
	PoemmaUserRole,
} from '../poemmaDomain';
import {
	formatPoemmaUserPeriodRange,
	POEMMA_HOME_COPY,
	POEMMA_SECTION_EYEBROW,
} from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaChecklistItem,
	PoemmaEyebrowLabel,
	PoemmaHeroPanel,
	PoemmaMapTile,
	PoemmaPageError,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageShell,
	PoemmaProgressBar,
	POEMMA_DISPLAY_TITLE_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaHomeAlignmentChecklist,
	summarizePoemmaHomeAlignment,
} from './poemmaHomeAlignment';
import {
	buildPoemmaHomeExperienceView,
	formatPoemmaHomeExperienceScoreLabel,
	getPoemmaHomeExperienceBarWidth,
	type PoemmaHomeExperienceView,
} from './poemmaHomeExperience';
import {
	formatPoemmaHomeMoneyRub,
	formatPoemmaHomeSourceBadge,
	getPoemmaHomeProfitProgressPercent,
	getPoemmaHomeProfitStatusLabel,
	resolvePoemmaHomeProfitFact,
	resolvePoemmaHomeProfitPlan,
	resolvePoemmaHomeProfitPlanStatus,
} from './poemmaHomeFinance';
import {
	buildPoemmaHomeGuideView,
	type PoemmaHomeGuideView,
} from './poemmaHomeGuide';
import {
	buildPoemmaHomePromoView,
	type PoemmaHomePromoView,
} from './poemmaHomePromo';

export type PoemmaHomeSession = {
	role: PoemmaUserRole;
	displayName: string;
};

export type PoemmaHomePageProps = {
	ownerUserId: string;
	session: PoemmaHomeSession;
	onNavigate: (path: string) => void;
};

type PoemmaHomeData = {
	period: PoemmaPeriod | null;
	strategy: PoemmaStrategyAnchor | null;
	goal: PoemmaPeriodGoal | null;
	segments: PoemmaCustomerSegment[];
	financeSnapshot: PoemmaFinanceSnapshot | null;
	experienceBalance: PoemmaExperienceBalance | null;
	npsSnapshot: PoemmaNpsSnapshot | null;
	experienceThresholdPercent: number;
	channels: PoemmaChannel[];
	promotions: PoemmaPromotionAction[];
	initiatives: PoemmaInitiative[];
};

function resolvePoemmaHomeErrorMessage(error: unknown): string {
	if (!error || typeof error !== 'object') {
		return 'Не удалось загрузить данные. Повторите ещё раз.';
	}
	const responseData = (
		error as { response?: { data?: { detail?: unknown; error?: unknown } } }
	).response?.data;
	if (
		typeof responseData?.detail === 'string' &&
		responseData.detail.trim().length > 0
	) {
		return responseData.detail.trim();
	}
	if (
		typeof responseData?.error === 'string' &&
		responseData.error.trim().length > 0
	) {
		return responseData.error.trim();
	}
	const message = (error as { message?: unknown }).message;
	if (typeof message === 'string' && message.trim().length > 0) {
		return message.trim();
	}
	return 'Не удалось загрузить данные. Повторите ещё раз.';
}

function PoemmaHomeHero({
	session,
	period,
	isOwner,
	onNavigate,
}: {
	session: PoemmaHomeSession;
	period: PoemmaPeriod | null;
	isOwner: boolean;
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageHeader
			variant="hero"
			eyebrow={POEMMA_SECTION_EYEBROW.home}
			title={session.displayName}
			description={
				isOwner
					? 'Прибыль, смысл продукта и действия команды — на одном экране.'
					: 'Смысл, опыт клиентов и ваши задачи — без лишних цифр собственника.'
			}
			meta={
				<>
					<PoemmaEyebrowLabel tone="muted">Период</PoemmaEyebrowLabel>
					<p className="mt-1 text-sm font-semibold text-(--desktop-text-primary)">
						{formatPoemmaUserPeriodRange(period)}
					</p>
				</>
			}
			actions={
				<>
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						onClick={() => onNavigate('/guide')}
					>
						Следующий шаг
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigate('/strategy')}
					>
						Смысл и УТП
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigate(isOwner ? '/finance' : '/team')}
					>
						{isOwner ? 'Цифры и план' : 'Задачи команды'}
					</DesktopAppButton>
				</>
			}
		/>
	);
}

function PoemmaHomeProfitEmptyState({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<div className="mt-6 grid gap-4">
			<p className="text-2xl font-semibold tracking-tight text-(--desktop-text-primary)">
				{POEMMA_HOME_COPY.profitEmptyTitle}
			</p>
			<DesktopAppButton
				type="button"
				variant="accent"
				onClick={() => onNavigate('/finance')}
			>
				{POEMMA_HOME_COPY.profitEmptyAction}
			</DesktopAppButton>
		</div>
	);
}

function PoemmaHomeProfitSnapshotBlock({
	snapshot,
	targetProfit,
	onNavigate,
}: {
	snapshot: PoemmaFinanceSnapshot;
	targetProfit?: number;
	onNavigate: (path: string) => void;
}) {
	const fact = resolvePoemmaHomeProfitFact(snapshot.profit);
	const plan = resolvePoemmaHomeProfitPlan(targetProfit);
	const planStatus = resolvePoemmaHomeProfitPlanStatus(fact, plan);
	const statusLabel = getPoemmaHomeProfitStatusLabel(planStatus);
	const progressPercent = getPoemmaHomeProfitProgressPercent(fact, plan);

	return (
		<div className="mt-6 grid gap-5">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<p className="text-4xl font-semibold tabular-nums tracking-tight text-(--desktop-text-primary)">
					{fact != null ? formatPoemmaHomeMoneyRub(fact) : '—'}
				</p>
				{plan != null ? (
					<p className="text-base font-medium text-(--desktop-text-secondary)">
						план {formatPoemmaHomeMoneyRub(plan)}
					</p>
				) : null}
			</div>

			{progressPercent != null ? (
				<PoemmaProgressBar
					value={progressPercent}
					tone={planStatus === 'on_plan' ? 'accent' : 'muted'}
					showPercent
					ariaLabel="Выполнение плана по прибыли"
				/>
			) : null}

			{statusLabel ? (
				<p
					className={cn(
						'text-base font-semibold',
						planStatus === 'on_plan'
							? 'text-[rgb(var(--desktop-accent-rgb))]'
							: 'text-(--desktop-text-primary)'
					)}
				>
					{statusLabel}
				</p>
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--desktop-border-subtle) pt-4">
				<span className="text-sm font-medium text-(--desktop-text-secondary)">
					{formatPoemmaHomeSourceBadge(snapshot.source, snapshot.syncedAt)}
				</span>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => onNavigate('/finance')}
				>
					Обновить
				</DesktopAppButton>
			</div>
		</div>
	);
}

function PoemmaHomeProfitBlock({
	financeSnapshot,
	targetProfit,
	onNavigate,
}: {
	financeSnapshot: PoemmaFinanceSnapshot | null;
	targetProfit?: number;
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPagePanel>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<PoemmaSectionTitle>Прибыль 90 дней</PoemmaSectionTitle>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => onNavigate('/finance')}
				>
					Цифры →
				</DesktopAppButton>
			</div>
			{financeSnapshot ? (
				<PoemmaHomeProfitSnapshotBlock
					snapshot={financeSnapshot}
					targetProfit={targetProfit}
					onNavigate={onNavigate}
				/>
			) : (
				<PoemmaHomeProfitEmptyState onNavigate={onNavigate} />
			)}
		</PoemmaPagePanel>
	);
}

function PoemmaHomeAlignmentBlock({
	items,
	summary,
	onNavigate,
}: {
	items: ReturnType<typeof buildPoemmaHomeAlignmentChecklist>;
	summary: { done: number; total: number };
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaMapTile
			sectionLabel="Всё сходится?"
			onNavigate={() => onNavigate('/strategy')}
		>
			<p className="text-3xl font-semibold tabular-nums tracking-tight text-(--desktop-text-primary)">
				{summary.done} из {summary.total}
			</p>
			<ul className="mt-5 space-y-2">
				{items.map((item) => (
					<PoemmaChecklistItem
						key={item.key}
						label={item.label}
						done={item.done}
					/>
				))}
			</ul>
		</PoemmaMapTile>
	);
}

function PoemmaHomeExperienceScoreBar({
	label,
	score,
}: {
	label: string;
	score: number;
}) {
	return (
		<div className="grid gap-1.5">
			<div className="flex items-center justify-between gap-2 text-sm font-medium text-(--desktop-text-primary)">
				<span>{label}</span>
				<span className="tabular-nums">
					{formatPoemmaHomeExperienceScoreLabel(score)}
				</span>
			</div>
			<PoemmaProgressBar
				value={getPoemmaHomeExperienceBarWidth(score)}
				size="sm"
				ariaLabel={`${label}: ${score}`}
			/>
		</div>
	);
}

function PoemmaHomeExperienceBlock({
	view,
	isOwner,
	onNavigate,
}: {
	view: PoemmaHomeExperienceView;
	isOwner: boolean;
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaMapTile
			sectionLabel="Опыт совпал?"
			onNavigate={() => onNavigate('/happiness')}
		>
			{view.mode === 'empty' ? (
				<div className="grid gap-4">
					<p className="text-xl font-semibold text-(--desktop-text-primary)">
						Нет оценок
					</p>
					{isOwner ? (
						<DesktopAppButton
							type="button"
							variant="accent"
							onClick={(event) => {
								event.stopPropagation();
								onNavigate('/happiness');
							}}
						>
							Ввести опрос
						</DesktopAppButton>
					) : null}
					{view.npsLine ? (
						<p className="text-sm font-medium text-(--desktop-text-secondary)">
							{view.npsLine}
						</p>
					) : null}
				</div>
			) : (
				<div className="grid gap-4">
					<p
						className={cn(
							'text-base font-semibold',
							view.inBalance
								? 'text-[rgb(var(--desktop-accent-rgb))]'
								: 'text-(--desktop-text-primary)'
						)}
					>
						{view.statusLabel}
					</p>
					<div className="grid gap-3">
						<PoemmaHomeExperienceScoreBar
							label="Команда"
							score={view.employeeScore ?? 0}
						/>
						<PoemmaHomeExperienceScoreBar
							label="Клиент"
							score={view.clientScore ?? 0}
						/>
					</div>
					{view.npsLine ? (
						<p className="text-sm font-medium text-(--desktop-text-secondary)">
							{view.npsLine}
						</p>
					) : null}
				</div>
			)}
		</PoemmaMapTile>
	);
}

function PoemmaHomePromoBlock({
	view,
	onNavigate,
}: {
	view: PoemmaHomePromoView;
	onNavigate: (path: string) => void;
}) {
	const promoPath =
		view.livePromotionId != null
			? `/promo/actions/${view.livePromotionId}`
			: '/promo';

	return (
		<PoemmaMapTile
			sectionLabel="Каналы"
			onNavigate={() => onNavigate(promoPath)}
		>
			<div className="grid gap-3">
				<p className="text-base font-semibold text-(--desktop-text-primary)">
					{view.headline}
				</p>
				{view.detailLine ? (
					<p className="text-base font-medium text-(--desktop-text-secondary)">
						{view.detailLine}
					</p>
				) : null}
				<p className="text-sm font-medium text-(--desktop-text-secondary)">
					{view.note}
				</p>
				{view.showOwnerCta ? (
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={(event) => {
							event.stopPropagation();
							onNavigate('/promo');
						}}
					>
						Есть деньги — акция
					</DesktopAppButton>
				) : null}
			</div>
		</PoemmaMapTile>
	);
}

function PoemmaHomeGuideBlock({
	view,
	onNavigate,
}: {
	view: PoemmaHomeGuideView;
	onNavigate: (path: string) => void;
}) {
	const testingIdeaPathBase =
		view.mode === 'testing' && view.testingInitiative
			? `/ideas/${view.testingInitiative.id}`
			: null;

	return (
		<PoemmaHeroPanel>
			<PoemmaSectionTitle>Что делать</PoemmaSectionTitle>

			{view.mode === 'testing' && view.testingInitiative ? (
				<div className="mt-5 grid gap-4">
					<p className="text-base font-medium text-(--desktop-text-secondary)">
						Идея в проверке
					</p>
					<p className={POEMMA_DISPLAY_TITLE_CLASS}>
						{view.testingInitiative.title}
					</p>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							variant="accent"
							onClick={() =>
								testingIdeaPathBase
									? onNavigate(`${testingIdeaPathBase}?decision=go`)
									: undefined
							}
						>
							Идём дальше
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							onClick={() =>
								testingIdeaPathBase
									? onNavigate(`${testingIdeaPathBase}?decision=stop`)
									: undefined
							}
						>
							Стоп
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							onClick={() =>
								testingIdeaPathBase
									? onNavigate(`${testingIdeaPathBase}?decision=iterate`)
									: undefined
							}
						>
							Доработать
						</DesktopAppButton>
					</div>
				</div>
			) : (
				<div className="mt-5 grid gap-3">
					{view.entries.map((entry) => (
						<DesktopAppButton
							key={entry.key}
							type="button"
							variant="accent"
							className="w-full justify-center py-3 text-base"
							onClick={() => onNavigate(entry.path)}
						>
							{entry.label}
						</DesktopAppButton>
					))}
				</div>
			)}
		</PoemmaHeroPanel>
	);
}

export function PoemmaHomePage({
	ownerUserId,
	session,
	onNavigate,
}: PoemmaHomePageProps) {
	const repository = useMemo(
		() => (ownerUserId.trim() ? getPoemmaRepository(ownerUserId) : null),
		[ownerUserId]
	);
	const isOwner = session.role === 'owner';

	const [data, setData] = useState<PoemmaHomeData | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		if (!repository) {
			setData(null);
			setLoadError(null);
			setIsLoaded(true);
			return;
		}

		let isMounted = true;
		const loadAttempt = reloadKey;
		const repo = repository;
		if (loadAttempt > 0) {
			setLoadError(null);
		}

		async function loadHomeData(): Promise<void> {
			try {
				setLoadError(null);
				const period = await repo.getCurrentPeriod();
				const org = await repo.getOrg();
				const orgId = org?.id ?? null;
				const periodId = period?.id ?? null;

				const [
					strategy,
					goal,
					segments,
					financeSnapshot,
					orgSettings,
					experienceBalance,
					npsSnapshot,
					channels,
					promotions,
					initiatives,
				] = await Promise.all([
					repo.getStrategy(),
					periodId ? repo.getPeriodGoal(periodId) : Promise.resolve(null),
					orgId ? repo.listSegments(orgId) : Promise.resolve([]),
					periodId ? repo.getFinanceSnapshot(periodId) : Promise.resolve(null),
					repo.getOrgSettings(),
					orgId ? repo.getExperienceBalance(orgId) : Promise.resolve(null),
					periodId ? repo.getNpsSnapshot(periodId) : Promise.resolve(null),
					orgId ? repo.listChannels(orgId) : Promise.resolve([]),
					periodId ? repo.listPromotions(periodId) : Promise.resolve([]),
					periodId ? repo.listInitiatives(periodId) : Promise.resolve([]),
				]);

				if (!isMounted) {
					return;
				}

				setData({
					period,
					strategy,
					goal,
					segments,
					financeSnapshot,
					experienceBalance,
					npsSnapshot,
					experienceThresholdPercent:
						orgSettings?.experienceBalanceThresholdPercent ?? 5,
					channels,
					promotions,
					initiatives,
				});
				setIsLoaded(true);
			} catch (error) {
				if (!isMounted) {
					return;
				}
				setData(null);
				setLoadError(resolvePoemmaHomeErrorMessage(error));
				setIsLoaded(true);
			}
		}

		setIsLoaded(false);
		void loadHomeData();

		return () => {
			isMounted = false;
		};
	}, [repository, reloadKey]);

	const alignmentItems = useMemo(
		() =>
			buildPoemmaHomeAlignmentChecklist({
				strategy: data?.strategy ?? {},
				goal: data?.goal ?? {},
				segments: data?.segments ?? [],
				period: data?.period ?? null,
			}),
		[data]
	);
	const alignmentSummary = useMemo(
		() => summarizePoemmaHomeAlignment(alignmentItems),
		[alignmentItems]
	);
	const experienceView = useMemo(
		() =>
			buildPoemmaHomeExperienceView({
				balance: data?.experienceBalance ?? null,
				nps: data?.npsSnapshot ?? null,
				thresholdPercent: data?.experienceThresholdPercent ?? 5,
			}),
		[data]
	);
	const promoView = useMemo(
		() =>
			buildPoemmaHomePromoView({
				channels: data?.channels ?? [],
				promotions: data?.promotions ?? [],
				isOwner,
			}),
		[data, isOwner]
	);
	const guideView = useMemo(
		() => buildPoemmaHomeGuideView(data?.initiatives ?? []),
		[data]
	);

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем карту бизнеса"
				description="Подтягиваем период, цели и текущие действия."
			/>
		);
	}

	if (loadError) {
		return (
			<PoemmaPageError
				title="Не удалось открыть главную карту"
				description={loadError}
				actions={
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={() => setReloadKey((previous) => previous + 1)}
					>
						Повторить загрузку
					</DesktopAppButton>
				}
			/>
		);
	}

	return (
		<PoemmaPageShell>
			<PoemmaHomeHero
				session={session}
				period={data?.period ?? null}
				isOwner={isOwner}
				onNavigate={onNavigate}
			/>
			{isOwner ? (
				<PoemmaHomeProfitBlock
					financeSnapshot={data?.financeSnapshot ?? null}
					targetProfit={data?.goal?.targetProfit}
					onNavigate={onNavigate}
				/>
			) : (
				<PoemmaPagePanel>
					<PoemmaSectionTitle>Карта команды</PoemmaSectionTitle>
					<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
						Прибыль и каналы скрыты. Видны смысл и задачи по роли.
					</p>
				</PoemmaPagePanel>
			)}

			<div
				className={cn(
					'grid gap-4 md:gap-5',
					isOwner ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
				)}
			>
				<PoemmaHomeAlignmentBlock
					items={alignmentItems}
					summary={alignmentSummary}
					onNavigate={onNavigate}
				/>
				<PoemmaHomeExperienceBlock
					view={experienceView}
					isOwner={isOwner}
					onNavigate={onNavigate}
				/>
				{isOwner ? (
					<PoemmaHomePromoBlock view={promoView} onNavigate={onNavigate} />
				) : null}
			</div>

			<PoemmaHomeGuideBlock view={guideView} onNavigate={onNavigate} />
		</PoemmaPageShell>
	);
}

export default PoemmaHomePage;
