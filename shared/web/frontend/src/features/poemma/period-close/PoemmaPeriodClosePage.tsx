/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only /period-close: 90-day review, publish to team, close active period → new draft.
 *
 * Invariants:
 * - Available when period.status === 'active' (owner).
 * - Uses closeActivePeriod and listPeriods; review persisted via repository.
 * - Team roles see access notice only.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §15
 * - poemma/docs/architecture/marketing-cabinet-backlog.md P-606
 */

import { useEffect, useMemo, useState } from 'react';
import {
	DesktopAppButton,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type {
	PoemmaPeriod,
	PoemmaPeriodReview,
	PoemmaUserRole,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaEyebrowLabel,
	PoemmaFieldError,
	PoemmaHeroPanel,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaPageShell,
	PoemmaAccessDenied,
	PoemmaSemanticText,
	type PoemmaSemanticTone,
	POEMMA_DISPLAY_TITLE_CLASS,
	POEMMA_DISPLAY_TITLE_HERO_CLASS,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaInitiativeVerdictSummary,
	createEmptyPoemmaPeriodReview,
	mergePoemmaPeriodReviewDraft,
	validatePoemmaPeriodCloseDecisions,
} from './poemmaPeriodCloseHelpers';

export type PoemmaPeriodClosePageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
	onPeriodClosed?: (draftPeriod: PoemmaPeriod) => void;
};

function formatPoemmaPeriodDate(date: string): string {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
	}).format(new Date(`${date}T00:00:00.000Z`));
}

export function buildPoemmaPeriodRangeLabel(period: PoemmaPeriod): string {
	return `${formatPoemmaPeriodDate(period.startDate)} – ${formatPoemmaPeriodDate(period.endDate)}`;
}

function formatPoemmaMoneyRub(value: number | undefined): string {
	if (value == null || value <= 0) {
		return '—';
	}
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value);
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function resolvePoemmaProfitResult(
	plan: number | undefined,
	fact: number | undefined
): { label: string; tone: PoemmaSemanticTone } | null {
	if (plan == null || plan <= 0 || fact == null || fact <= 0) {
		return null;
	}
	if (fact >= plan) {
		return {
			label: 'План выполнен',
			tone: 'success',
		};
	}
	const completion = Math.max(
		0,
		Math.min(100, Math.round((fact / plan) * 100))
	);
	return {
		label: `Выполнено ${completion}%`,
		tone: 'warning',
	};
}

function PoemmaPeriodCloseHero({
	period,
	profitPlan,
	profitFact,
	onNavigate,
}: {
	period: PoemmaPeriod;
	profitPlan: number | undefined;
	profitFact: number | undefined;
	onNavigate: (path: string) => void;
}) {
	const result = resolvePoemmaProfitResult(profitPlan, profitFact);

	return (
		<PoemmaHeroPanel>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-2">
					<PoemmaEyebrowLabel>Итоговый этап</PoemmaEyebrowLabel>
					<h2 className={POEMMA_DISPLAY_TITLE_HERO_CLASS}>
						Закрытие периода 90 дней
					</h2>
					<p className="text-sm leading-6 text-(--desktop-text-secondary)">
						{buildPoemmaPeriodRangeLabel(period)}
					</p>
					{result ? (
						<PoemmaSemanticText tone={result.tone} className="text-sm">
							{result.label}
						</PoemmaSemanticText>
					) : null}
				</div>
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigate('/finance')}
					>
						Обновить факт
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigate('/ideas')}
					>
						Проверить идеи
					</DesktopAppButton>
				</div>
			</div>
		</PoemmaHeroPanel>
	);
}

function PoemmaPeriodCloseAccessDenied() {
	return (
		<PoemmaAccessDenied description="Итоги 90 дней и закрытие периода доступны только собственнику." />
	);
}

function PoemmaPeriodCloseNoActive({
	onNavigate,
	periodStatus,
}: {
	onNavigate: (path: string) => void;
	periodStatus: 'draft' | 'closed' | 'none';
}) {
	const description =
		periodStatus === 'draft'
			? 'Сначала активируйте период: задайте цель по прибыли и запустите 90 дней.'
			: periodStatus === 'closed'
				? 'Активного периода нет. Новый черновик уже создан — задайте цель и активируйте.'
				: 'Создайте основу бизнеса на карте, чтобы появился период.';

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет активного периода</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					{description}
				</p>
				<DesktopAppButton
					type="button"
					variant="accent"
					className="mt-4"
					onClick={() => onNavigate(periodStatus === 'none' ? '/' : '/goal')}
				>
					{periodStatus === 'none' ? 'На карту' : 'К цели 90 дней'}
				</DesktopAppButton>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}

type ReviewDraft = {
	whatWorked: string;
	whatFailed: string;
	decisions: [string, string, string];
};

const POEMMA_PERIOD_REVIEW_DECISION_SLOT_KEYS = [
	'decision-1',
	'decision-2',
	'decision-3',
] as const;

export function PoemmaPeriodClosePage({
	ownerUserId,
	userRole,
	onNavigate,
	onPeriodClosed,
}: PoemmaPeriodClosePageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);

	const [activePeriod, setActivePeriod] = useState<PoemmaPeriod | null>(null);
	const [inactiveStatus, setInactiveStatus] = useState<
		'draft' | 'closed' | 'none'
	>('none');
	const [profitPlan, setProfitPlan] = useState<number | undefined>();
	const [profitFact, setProfitFact] = useState<number | undefined>();
	const [draft, setDraft] = useState<ReviewDraft>({
		whatWorked: '',
		whatFailed: '',
		decisions: ['', '', ''],
	});
	const [publishedToTeam, setPublishedToTeam] = useState(false);
	const [ideasSummary, setIdeasSummary] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [closedDraftPeriod, setClosedDraftPeriod] =
		useState<PoemmaPeriod | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isPublishing, setIsPublishing] = useState(false);
	const [isClosing, setIsClosing] = useState(false);

	useEffect(() => {
		if (userRole !== 'owner') {
			setIsLoaded(true);
			return;
		}

		let isMounted = true;

		async function loadPeriodClose(): Promise<void> {
			const periods = await repository.listPeriods();
			const active =
				periods.find((period) => period.status === 'active') ?? null;

			if (!isMounted) {
				return;
			}

			if (!active) {
				const current = periods[0] ?? null;
				setActivePeriod(null);
				setInactiveStatus(
					current?.status === 'draft'
						? 'draft'
						: current?.status === 'closed'
							? 'closed'
							: 'none'
				);
				setIsLoaded(true);
				return;
			}

			const [goal, finance, review, initiatives] = await Promise.all([
				repository.getPeriodGoal(active.id),
				repository.getFinanceSnapshot(active.id),
				repository.getPeriodReview(active.id),
				repository.listInitiatives(active.id),
			]);

			if (!isMounted) {
				return;
			}

			const baseReview = review ?? createEmptyPoemmaPeriodReview(active.id);
			setActivePeriod(active);
			setInactiveStatus('none');
			setProfitPlan(goal?.targetProfit ?? review?.profitPlan);
			setProfitFact(finance?.profit ?? review?.profitFact);
			setDraft({
				whatWorked: baseReview.whatWorked,
				whatFailed: baseReview.whatFailed,
				decisions: [...baseReview.decisions],
			});
			setPublishedToTeam(baseReview.publishedToTeam);
			setIdeasSummary(buildPoemmaInitiativeVerdictSummary(initiatives));
			setIsLoaded(true);
		}

		setIsLoaded(false);
		setClosedDraftPeriod(null);
		void loadPeriodClose();

		return () => {
			isMounted = false;
		};
	}, [repository, userRole]);

	if (userRole !== 'owner') {
		return <PoemmaPeriodCloseAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Готовим закрытие периода"
				description="Подтягиваем прибыль, итоги и решения по инициативам."
			/>
		);
	}

	if (closedDraftPeriod) {
		return (
			<PoemmaPageShell>
				<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />
				<PoemmaPagePanel>
					<PoemmaEyebrowLabel>Период закрыт</PoemmaEyebrowLabel>
					<h1 className={cn('mt-2', POEMMA_DISPLAY_TITLE_CLASS)}>
						Новый период · черновик
					</h1>
					<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
						{buildPoemmaPeriodRangeLabel(closedDraftPeriod)}
					</p>
					{statusMessage ? (
						<p className="mt-3 text-sm font-semibold text-(--desktop-text-secondary)">
							{statusMessage}
						</p>
					) : null}
					<PoemmaActionRow
						className="mt-4"
						actions={
							<>
								<DesktopAppButton
									type="button"
									variant="accent"
									onClick={() => onNavigate('/goal')}
								>
									Цель 90 дней
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={() => onNavigate('/')}
								>
									На карту
								</DesktopAppButton>
							</>
						}
					/>
				</PoemmaPagePanel>
			</PoemmaPageShell>
		);
	}

	if (!activePeriod) {
		return (
			<PoemmaPeriodCloseNoActive
				onNavigate={onNavigate}
				periodStatus={inactiveStatus}
			/>
		);
	}

	const period = activePeriod;

	async function persistReview(
		overrides: Partial<PoemmaPeriodReview> = {}
	): Promise<PoemmaPeriodReview> {
		const existing =
			(await repository.getPeriodReview(period.id)) ??
			createEmptyPoemmaPeriodReview(period.id);
		const next = mergePoemmaPeriodReviewDraft(existing, {
			whatWorked: draft.whatWorked,
			whatFailed: draft.whatFailed,
			decisions: draft.decisions,
			profitPlan,
			profitFact,
		});
		const merged: PoemmaPeriodReview = {
			...next,
			...overrides,
		};
		await repository.savePeriodReview(merged);
		return merged;
	}

	async function handlePublish(): Promise<void> {
		setValidationError(null);
		setStatusMessage(null);
		setIsPublishing(true);
		try {
			await persistReview({ publishedToTeam: true });
			setPublishedToTeam(true);
			setStatusMessage('Опубликовано команде');
		} finally {
			setIsPublishing(false);
		}
	}

	async function handleClosePeriod(): Promise<void> {
		setValidationError(null);
		setStatusMessage(null);

		const decisionError = validatePoemmaPeriodCloseDecisions(draft.decisions);
		if (decisionError) {
			setValidationError(decisionError);
			return;
		}

		setIsClosing(true);
		try {
			const closedAt = new Date().toISOString();
			await persistReview({ publishedToTeam, closedAt });
			const newDraft = await repository.closeActivePeriod(todayIso());
			setClosedDraftPeriod(newDraft);
			setActivePeriod(null);
			setInactiveStatus('closed');
			setStatusMessage('Период закрыт. Новый черновик на 90 дней с сегодня.');
			onPeriodClosed?.(newDraft);
		} catch (error) {
			setValidationError(
				error instanceof Error ? error.message : 'Не удалось закрыть период'
			);
		} finally {
			setIsClosing(false);
		}
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			<PoemmaPageHeader
				eyebrow={POEMMA_SECTION_EYEBROW.periodClose}
				title="Закрытие периода"
				description="Подведите итоги, поделитесь с командой и начните новый цикл 90 дней."
				meta={buildPoemmaPeriodRangeLabel(period)}
			/>

			<PoemmaPeriodCloseHero
				period={period}
				profitPlan={profitPlan}
				profitFact={profitFact}
				onNavigate={onNavigate}
			/>

			<PoemmaPagePanel>
				<PoemmaEyebrowLabel>Ретроспектива</PoemmaEyebrowLabel>
				<h1 className={cn('mt-2', POEMMA_DISPLAY_TITLE_CLASS)}>
					Итоги 90 дней
				</h1>

				<PoemmaPageSection spacing="compact">
					<section className="grid gap-2">
						<PoemmaSectionTitle>Прибыль</PoemmaSectionTitle>
						<div className="flex flex-wrap gap-8">
							<div>
								<p className="text-sm font-semibold text-(--desktop-text-secondary)">
									План
								</p>
								<p className="text-2xl font-semibold text-(--desktop-text-primary)">
									{formatPoemmaMoneyRub(profitPlan)}
								</p>
							</div>
							<div>
								<p className="text-sm font-semibold text-(--desktop-text-secondary)">
									Факт
								</p>
								<p className="text-2xl font-semibold text-(--desktop-text-primary)">
									{formatPoemmaMoneyRub(profitFact)}
								</p>
							</div>
						</div>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="mt-1 w-fit"
							onClick={() => onNavigate('/finance')}
						>
							Ввести факт
						</DesktopAppButton>
					</section>
				</PoemmaPageSection>

				<PoemmaPageSection spacing="compact">
					<label className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Что сработало
						</span>
						<textarea
							className={POEMMA_TEXTAREA_CLASS}
							rows={3}
							value={draft.whatWorked}
							onChange={(event) => {
								setDraft((prev) => ({
									...prev,
									whatWorked: event.target.value,
								}));
								setValidationError(null);
								setStatusMessage(null);
							}}
						/>
					</label>
				</PoemmaPageSection>

				<PoemmaPageSection spacing="compact">
					<label className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Что не сработало
						</span>
						<textarea
							className={POEMMA_TEXTAREA_CLASS}
							rows={3}
							value={draft.whatFailed}
							onChange={(event) => {
								setDraft((prev) => ({
									...prev,
									whatFailed: event.target.value,
								}));
								setValidationError(null);
								setStatusMessage(null);
							}}
						/>
					</label>
				</PoemmaPageSection>

				<PoemmaPageSection
					label="3 решения на след. период"
					spacing="compact"
					variant="framed"
				>
					{draft.decisions.map((value, index) => (
						<label
							key={POEMMA_PERIOD_REVIEW_DECISION_SLOT_KEYS[index]}
							className="grid gap-1"
						>
							<span className="text-sm font-semibold text-(--desktop-text-secondary)">
								{index + 1}.
							</span>
							<input
								type="text"
								className={POEMMA_TEXTAREA_CLASS}
								value={value}
								onChange={(event) => {
									const next = [...draft.decisions] as [string, string, string];
									next[index] = event.target.value;
									setDraft((prev) => ({ ...prev, decisions: next }));
									setValidationError(null);
									setStatusMessage(null);
								}}
							/>
						</label>
					))}
				</PoemmaPageSection>

				<PoemmaPageSection spacing="compact">
					<DesktopProductStatusBanner
						tone="neutral"
						title="Сводка по инициативам"
						description={ideasSummary}
					/>
					<PoemmaFieldError message={validationError} />
					{statusMessage ? (
						<DesktopProductStatusBanner
							tone="success"
							title="Изменения сохранены"
							description={statusMessage}
						/>
					) : null}
					{publishedToTeam ? (
						<DesktopProductStatusBanner
							tone="neutral"
							title="Опубликовано команде"
							description="Команда видит опубликованные итоги в read-only режиме."
						/>
					) : null}
				</PoemmaPageSection>

				<PoemmaActionRow
					className="mt-6"
					actions={
						<>
							<DesktopAppButton
								type="button"
								variant="neutral"
								disabled={isPublishing || isClosing}
								onClick={() => void handlePublish()}
							>
								{isPublishing ? 'Публикуем…' : 'Опубликовать команде'}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={isPublishing || isClosing}
								onClick={() => void handleClosePeriod()}
							>
								{isClosing ? 'Закрываем…' : 'Закрыть период'}
							</DesktopAppButton>
						</>
					}
				/>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
