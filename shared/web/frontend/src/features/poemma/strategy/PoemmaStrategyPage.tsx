/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Strategy and UTP screens for Poemma (P-105, P-106): vision, mission, values, UTP, team acknowledgment.
 *
 * Invariants:
 * - Owner edits full strategy; team/manager read brief only (manager read-only).
 * - Repository is the only data access path; labels ≤5 words in lists.
 * - No agency KPI or marketing-dashboard copy.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §2–3
 * - src/features/poemma/poemmaRepository.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	buildPoemmaAlignmentChecklist,
	type PoemmaPeriodGoal,
	type PoemmaStrategyAnchor,
	type PoemmaUserRole,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaHeroPanel,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaPageShell,
	PoemmaEyebrowLabel,
	PoemmaStepIndicator,
	POEMMA_DISPLAY_TITLE_HERO_CLASS,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaTeamBrief,
	canPoemmaTeamAcknowledgeStrategy,
	countPoemmaAlignmentProgress,
	createEmptyPoemmaStrategy,
	ensurePoemmaStrategyValueSlots,
	isPoemmaStrategyEmpty,
	isPoemmaStrategyOwner,
	mergePoemmaStrategySave,
	normalizePoemmaStrategyValues,
	POEMMA_STRATEGY_MAX_VALUES,
	validatePoemmaStrategyDraft,
	type PoemmaStrategyView,
} from './poemmaStrategyForm';

export type PoemmaStrategyPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
	initialView?: PoemmaStrategyView;
};

type StrategyDraft = {
	vision: string;
	mission: string;
	values: string[];
	utp: string;
	teamUnderstood: boolean;
};

function strategyToDraft(strategy: PoemmaStrategyAnchor): StrategyDraft {
	return {
		vision: strategy.vision,
		mission: strategy.mission,
		values: ensurePoemmaStrategyValueSlots(strategy.values),
		utp: strategy.utp,
		teamUnderstood: !!strategy.teamUnderstood,
	};
}

function AlignmentDots({ done, total }: { done: number; total: number }) {
	return (
		<div className="flex items-center gap-2">
			<PoemmaEyebrowLabel tone="muted">Совпадение</PoemmaEyebrowLabel>
			<PoemmaStepIndicator
				filled={done}
				total={total}
				size="sm"
				ariaLabel={`Совпадение ${done} из ${total}`}
			/>
			<span className="text-sm font-semibold text-(--desktop-text-secondary)">
				{done} из {total}
			</span>
		</div>
	);
}

function StrategyFieldLabel({ children }: { children: string }) {
	return <PoemmaEyebrowLabel tone="muted">{children}</PoemmaEyebrowLabel>;
}

function StrategyHero({
	isOwner,
	done,
	total,
	onNavigate,
}: {
	isOwner: boolean;
	done: number;
	total: number;
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaHeroPanel>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<PoemmaSectionTitle>Основа карты</PoemmaSectionTitle>
					<h2 className={cn('mt-2', POEMMA_DISPLAY_TITLE_HERO_CLASS)}>
						Видение, миссия, ценности, УТП
					</h2>
					<p className="mt-2 text-sm leading-6 text-(--desktop-text-secondary)">
						{isOwner
							? 'Сформулируйте позицию одним живым языком, чтобы команда принимала решения в одном направлении.'
							: 'Короткая выжимка для команды: куда идём, зачем и как проверяем фокус.'}
					</p>
				</div>
				<AlignmentDots done={done} total={total} />
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					onClick={() => onNavigate('/strategy?view=utp')}
				>
					Проверить УТП
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => onNavigate('/guide')}
				>
					Что делать дальше
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => onNavigate(isOwner ? '/goal' : '/')}
				>
					{isOwner ? 'Сверить цель' : 'Вернуться на карту'}
				</DesktopAppButton>
			</div>
		</PoemmaHeroPanel>
	);
}

export function PoemmaStrategyPage({
	ownerUserId,
	userRole,
	onNavigate,
	initialView = 'main',
}: PoemmaStrategyPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId),
		[ownerUserId]
	);
	const isOwner = isPoemmaStrategyOwner(userRole);
	const canAcknowledge = canPoemmaTeamAcknowledgeStrategy(userRole);

	const [view, setView] = useState<PoemmaStrategyView>(initialView);
	const [strategy, setStrategy] = useState<PoemmaStrategyAnchor | null>(null);
	const [goal, setGoal] = useState<PoemmaPeriodGoal | null>(null);
	const [draft, setDraft] = useState<StrategyDraft | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setView(initialView);
	}, [initialView]);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const org = await repository.getOrg();
			if (!org) {
				setStrategy(null);
				setGoal(null);
				return;
			}
			const [storedStrategy, period] = await Promise.all([
				repository.getStrategy(),
				repository.getCurrentPeriod(),
			]);
			const nextGoal = period
				? await repository.getPeriodGoal(period.id)
				: null;
			setStrategy(storedStrategy);
			setGoal(nextGoal);
			if (storedStrategy) {
				setDraft(strategyToDraft(storedStrategy));
			} else {
				setDraft(
					strategyToDraft(createEmptyPoemmaStrategy(org.id, ownerUserId))
				);
			}
		} catch (loadError) {
			setError(
				loadError instanceof Error ? loadError.message : 'Не удалось загрузить'
			);
		} finally {
			setIsLoading(false);
		}
	}, [ownerUserId, repository]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const alignment = useMemo(() => {
		if (!strategy) {
			return {
				done: 0,
				total: 5,
				items: buildPoemmaAlignmentChecklist({}, {}, false),
			};
		}
		const items = buildPoemmaAlignmentChecklist(
			strategy,
			goal ?? {},
			!!strategy.teamUnderstood
		);
		const progress = countPoemmaAlignmentProgress(strategy, goal ?? {});
		return { ...progress, items };
	}, [strategy, goal]);

	const teamBrief = useMemo(
		() => buildPoemmaTeamBrief(strategy ?? {}),
		[strategy]
	);

	function navigateTo(path: string): void {
		setView(path.includes('view=utp') ? 'utp' : 'main');
		onNavigate(path);
	}

	async function persistStrategy(
		next: PoemmaStrategyAnchor,
		options?: { exitEdit?: boolean }
	): Promise<void> {
		setIsSaving(true);
		setError(null);
		try {
			await repository.saveStrategy(next);
			setStrategy(next);
			setDraft(strategyToDraft(next));
			if (options?.exitEdit) {
				setIsEditing(false);
			}
		} catch (saveError) {
			setError(
				saveError instanceof Error ? saveError.message : 'Не удалось сохранить'
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function ensureStrategyBase(): Promise<PoemmaStrategyAnchor | null> {
		const org = await repository.getOrg();
		if (!org) {
			setError('Сначала создайте основу карты');
			return null;
		}
		if (strategy) {
			return strategy;
		}
		const created = createEmptyPoemmaStrategy(org.id, ownerUserId);
		await repository.saveStrategy(created);
		setStrategy(created);
		setDraft(strategyToDraft(created));
		return created;
	}

	async function handleOwnerSave(requireUtp: boolean): Promise<void> {
		if (!draft) {
			return;
		}
		const validationError = validatePoemmaStrategyDraft({
			vision: draft.vision,
			mission: draft.mission,
			values: draft.values,
			utp: draft.utp,
			requireUtp,
		});
		if (validationError) {
			setError(validationError);
			return;
		}
		const base = (await ensureStrategyBase()) ?? strategy;
		if (!base) {
			return;
		}
		const next = mergePoemmaStrategySave(
			base,
			{
				vision: draft.vision.trim(),
				mission: draft.mission.trim(),
				values: normalizePoemmaStrategyValues(draft.values),
				utp: draft.utp.trim(),
				teamUnderstood: draft.teamUnderstood,
			},
			ownerUserId
		);
		await persistStrategy(next, { exitEdit: !requireUtp && view === 'main' });
	}

	async function handleTeamUnderstood(): Promise<void> {
		const base = strategy ?? (await ensureStrategyBase());
		if (!base) {
			return;
		}
		const next = mergePoemmaStrategySave(
			base,
			{ teamUnderstood: true },
			ownerUserId
		);
		await persistStrategy(next);
	}

	async function handleOwnerTeamUnderstood(value: boolean): Promise<void> {
		if (!draft) {
			return;
		}
		setDraft({ ...draft, teamUnderstood: value });
		const base = (await ensureStrategyBase()) ?? strategy;
		if (!base) {
			return;
		}
		const next = mergePoemmaStrategySave(
			base,
			{ teamUnderstood: value },
			ownerUserId
		);
		await persistStrategy(next);
	}

	function updateDraftValue(index: number, value: string): void {
		if (!draft) {
			return;
		}
		const values = [...draft.values];
		values[index] = value;
		setDraft({ ...draft, values });
	}

	function addValueRow(): void {
		if (!draft || draft.values.length >= POEMMA_STRATEGY_MAX_VALUES) {
			return;
		}
		setDraft({ ...draft, values: [...draft.values, ''] });
	}

	if (isLoading) {
		return (
			<PoemmaPageLoading
				title="Загружаем стратегию"
				description="Подтягиваем видение, миссию и цели периода."
			/>
		);
	}

	if (view === 'utp') {
		return (
			<PoemmaPageShell>
				<PoemmaNavRail
					backLabel="← К смыслу"
					onBack={() => navigateTo('/strategy')}
				/>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.strategy}
					title="УТП"
					description="Чем вы отличаетесь — коротко и ясно."
				/>
				<PoemmaPagePanel>
					<p className="text-sm leading-6 text-(--desktop-text-secondary)">
						Одна ясная фраза: кому помогаете, какую боль закрываете и почему
						именно вам верят.
					</p>
				</PoemmaPagePanel>
				{error ? (
					<DesktopProductStatusBanner
						tone="warning"
						title="Проверьте поля"
						description={error}
					/>
				) : null}
				<PoemmaPagePanel className="grid gap-4">
					<StrategyFieldLabel>Чем отличаемся</StrategyFieldLabel>
					{isOwner && draft ? (
						<textarea
							className={POEMMA_TEXTAREA_CLASS}
							rows={5}
							value={draft.utp}
							onChange={(event) =>
								setDraft({ ...draft, utp: event.target.value })
							}
							placeholder="Одно предложение, без жаргона"
							aria-label="УТП"
						/>
					) : (
						<p className="text-base leading-7 text-(--desktop-text-primary)">
							{strategy?.utp?.trim() || 'УТП ещё не задано'}
						</p>
					)}
				</PoemmaPagePanel>
				<PoemmaPagePanel className="grid gap-3">
					<StrategyFieldLabel>Понятно команде?</StrategyFieldLabel>
					{isOwner ? (
						<fieldset className="flex flex-wrap gap-4">
							<label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-(--desktop-text-primary)">
								<input
									type="radio"
									name="team-understood"
									checked={draft?.teamUnderstood === true}
									onChange={() => void handleOwnerTeamUnderstood(true)}
									disabled={isSaving}
								/>
								Да, обсудили
							</label>
							<label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-(--desktop-text-primary)">
								<input
									type="radio"
									name="team-understood"
									checked={draft?.teamUnderstood === false}
									onChange={() => void handleOwnerTeamUnderstood(false)}
									disabled={isSaving}
								/>
								Нет, доработать
							</label>
						</fieldset>
					) : (
						<p className="text-sm text-(--desktop-text-secondary)">
							{strategy?.teamUnderstood
								? 'Команда подтвердила понимание'
								: 'Ждём подтверждения команды'}
						</p>
					)}
					{canAcknowledge && !strategy?.teamUnderstood ? (
						<DesktopAppButton
							type="button"
							variant="accent"
							disabled={isSaving || isPoemmaStrategyEmpty(strategy)}
							onClick={() => void handleTeamUnderstood()}
						>
							Понятно
						</DesktopAppButton>
					) : null}
				</PoemmaPagePanel>
				{isOwner ? (
					<PoemmaActionRow
						actions={
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={isSaving}
								onClick={() => void handleOwnerSave(true)}
							>
								Сохранить
							</DesktopAppButton>
						}
					/>
				) : null}
			</PoemmaPageShell>
		);
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />
			<PoemmaPageHeader
				eyebrow={POEMMA_SECTION_EYEBROW.strategy}
				title="Видение и смысл"
				description={
					isOwner
						? 'Видение, миссия и ценности — основа карты.'
						: 'Краткая выжимка для команды.'
				}
			/>
			<StrategyHero
				isOwner={isOwner}
				done={alignment.done}
				total={alignment.total}
				onNavigate={navigateTo}
			/>
			{error ? (
				<DesktopProductStatusBanner
					tone="warning"
					title="Проверьте поля"
					description={error}
				/>
			) : null}
			{isPoemmaStrategyEmpty(strategy) ? (
				<DesktopAppEmptyState
					title="Заполните смысл"
					description="Видение, миссия и УТП задаются на онбординге или здесь."
				>
					{isOwner ? (
						<DesktopAppButton
							type="button"
							variant="accent"
							onClick={() => onNavigate('/onboarding')}
						>
							Онбординг
						</DesktopAppButton>
					) : null}
				</DesktopAppEmptyState>
			) : null}
			{isOwner ? (
				<>
					<PoemmaPageSection
						action={
							!isEditing ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={() => setIsEditing(true)}
								>
									Редактировать
								</DesktopAppButton>
							) : (
								<div className="flex flex-wrap gap-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										disabled={isSaving}
										onClick={() => {
											if (strategy) {
												setDraft(strategyToDraft(strategy));
											}
											setIsEditing(false);
											setError(null);
										}}
									>
										Отмена
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="accent"
										disabled={isSaving}
										onClick={() => void handleOwnerSave(false)}
									>
										Сохранить
									</DesktopAppButton>
								</div>
							)
						}
					>
						<AlignmentDots done={alignment.done} total={alignment.total} />
					</PoemmaPageSection>
					<PoemmaPagePanel className="grid gap-4">
						<StrategyFieldLabel>Видение</StrategyFieldLabel>
						{isEditing && draft ? (
							<textarea
								className={POEMMA_TEXTAREA_CLASS}
								rows={4}
								value={draft.vision}
								onChange={(event) =>
									setDraft({ ...draft, vision: event.target.value })
								}
								aria-label="Видение"
							/>
						) : (
							<p className="whitespace-pre-wrap text-base leading-7 text-(--desktop-text-primary)">
								{strategy?.vision?.trim() || '—'}
							</p>
						)}
					</PoemmaPagePanel>
					<PoemmaPagePanel className="grid gap-4">
						<StrategyFieldLabel>Миссия</StrategyFieldLabel>
						{isEditing && draft ? (
							<textarea
								className={POEMMA_TEXTAREA_CLASS}
								rows={4}
								value={draft.mission}
								onChange={(event) =>
									setDraft({ ...draft, mission: event.target.value })
								}
								aria-label="Миссия"
							/>
						) : (
							<p className="whitespace-pre-wrap text-base leading-7 text-(--desktop-text-primary)">
								{strategy?.mission?.trim() || '—'}
							</p>
						)}
					</PoemmaPagePanel>
					<PoemmaPagePanel className="grid gap-4">
						<StrategyFieldLabel>Ценности</StrategyFieldLabel>
						{isEditing && draft ? (
							<div className="grid gap-3">
								{draft.values.map((value, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: editable slots keep stable order
									<label key={index} className="grid gap-1">
										<span className="text-xs font-medium text-(--desktop-text-muted)">
											Ценность {index + 1}
										</span>
										<input
											className={cn(POEMMA_TEXTAREA_CLASS, 'resize-none py-2')}
											value={value}
											onChange={(event) =>
												updateDraftValue(index, event.target.value)
											}
										/>
									</label>
								))}
								{draft.values.length < POEMMA_STRATEGY_MAX_VALUES ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={addValueRow}
									>
										+ Ещё
									</DesktopAppButton>
								) : null}
							</div>
						) : (
							<ul className="list-inside list-disc space-y-2 text-base leading-7 text-(--desktop-text-primary)">
								{normalizePoemmaStrategyValues(strategy?.values ?? []).map(
									(value) => (
										<li key={value}>{value}</li>
									)
								)}
							</ul>
						)}
					</PoemmaPagePanel>
				</>
			) : (
				<PoemmaPagePanel className="grid gap-3">
					<StrategyFieldLabel>Стратегия</StrategyFieldLabel>
					<p className="text-base leading-7 text-(--desktop-text-primary)">
						{teamBrief || 'Собственник ещё не опубликовал выжимку.'}
					</p>
					{strategy?.utp?.trim() ? (
						<p className="text-sm text-(--desktop-text-secondary)">
							<span className="font-semibold text-(--desktop-text-primary)">
								УТП:
							</span>{' '}
							{strategy.utp.trim()}
						</p>
					) : null}
					{canAcknowledge && !strategy?.teamUnderstood ? (
						<DesktopAppButton
							type="button"
							variant="accent"
							disabled={isSaving || !teamBrief}
							onClick={() => void handleTeamUnderstood()}
						>
							Понятно
						</DesktopAppButton>
					) : strategy?.teamUnderstood ? (
						<DesktopProductStatusBanner
							tone="neutral"
							title="Команда поняла"
							description="Подтверждение сохранено."
						/>
					) : null}
				</PoemmaPagePanel>
			)}
			<PoemmaPagePanel className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1 space-y-2">
					<PoemmaSectionTitle>УТП</PoemmaSectionTitle>
					<p className="text-base leading-7 text-(--desktop-text-primary)">
						{strategy?.utp?.trim() || 'УТП ещё не задано'}
					</p>
				</div>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={() => navigateTo('/strategy?view=utp')}
				>
					Открыть →
				</DesktopAppButton>
			</PoemmaPagePanel>
			{isOwner ? (
				<ul className="sr-only" aria-hidden>
					{alignment.items.map((item) => (
						<li key={item.key}>{item.label}</li>
					))}
				</ul>
			) : null}
		</PoemmaPageShell>
	);
}

export default PoemmaStrategyPage;
