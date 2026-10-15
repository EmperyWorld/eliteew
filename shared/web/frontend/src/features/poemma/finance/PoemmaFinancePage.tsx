/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only `/finance` profit tab (P-202): manual revenue/profit, plan vs fact, marketplace note.
 *
 * Invariants:
 * - Team and non-owner roles see access notice only.
 * - Data via getPoemmaRepository (getFinanceSnapshot, getPeriodGoal, savePeriodGoal path via goal).
 * - One large truth line: plan / fact / % — no marketing KPI tables.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §6.1
 * - poemma/docs/architecture/marketing-cabinet-backlog.md P-201–P-204
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type {
	PoemmaFinanceSnapshot,
	PoemmaPeriod,
	PoemmaPeriodGoal,
	PoemmaUserRole,
} from '../poemmaDomain';
import {
	POEMMA_ACCESS_DENIED,
	POEMMA_FINANCE_COPY,
	POEMMA_SECTION_EYEBROW,
} from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import { buildPoemmaPeriodRollingLabel } from '../goal/PoemmaGoalPage';
import {
	PoemmaActionRow,
	PoemmaFieldError,
	PoemmaFormField,
	PoemmaMetricBadge,
	PoemmaNavRail,
	PoemmaPageError,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaAccessDenied,
	PoemmaPageShell,
	PoemmaProfitPlanFactRow,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaFinanceSourceBadge,
	computePoemmaProfitPlanSummary,
	financeNumbersToInputs,
	formatPoemmaFinanceMoneyRub,
	hasPoemmaMarketplaceFlag,
	isPoemmaFinanceOwner,
	mergePoemmaFinanceManualSave,
	POEMMA_MARKETPLACE_FLAG_LABEL,
	parsePoemmaMoneyInput,
	resolvePoemmaMarketplaceNote,
	validatePoemmaFinanceDraft,
} from './poemmaFinanceForm';

export interface PoemmaFinancePageProps {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
}

function PoemmaFinanceAccessDenied() {
	return (
		<PoemmaAccessDenied description={POEMMA_ACCESS_DENIED.financeDescription} />
	);
}

function PoemmaFinanceNoPeriod({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет периода</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					Сначала создайте основу бизнеса на карте — появится период 90 дней.
				</p>
				<DesktopAppButton
					type="button"
					variant="accent"
					className="mt-4"
					onClick={() => onNavigate('/')}
				>
					На карту
				</DesktopAppButton>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}

function resolvePoemmaFinanceLoadError(error: unknown): string {
	return error instanceof Error
		? error.message
		: 'Не удалось загрузить данные по прибыли.';
}

export function PoemmaFinancePage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaFinancePageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [period, setPeriod] = useState<PoemmaPeriod | null>(null);
	const [goal, setGoal] = useState<PoemmaPeriodGoal | null>(null);
	const [snapshot, setSnapshot] = useState<PoemmaFinanceSnapshot | null>(null);
	const [revenueInput, setRevenueInput] = useState('');
	const [profitInput, setProfitInput] = useState('');
	const [marketplaceEnabled, setMarketplaceEnabled] = useState(false);
	const [marketplaceNote, setMarketplaceNote] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [syncMessage, setSyncMessage] = useState<string | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		if (!isPoemmaFinanceOwner(userRole)) {
			setIsLoaded(true);
			return;
		}

		let isMounted = true;

		async function loadFinancePage(attempt: number): Promise<void> {
			try {
				const currentPeriod = await repository.getCurrentPeriod();
				if (!isMounted || attempt !== reloadKey) {
					return;
				}
				if (!currentPeriod) {
					setPeriod(null);
					setGoal(null);
					setSnapshot(null);
					setLoadError(null);
					setIsLoaded(true);
					return;
				}

				const [periodGoal, financeSnapshot] = await Promise.all([
					repository.getPeriodGoal(currentPeriod.id),
					repository.getFinanceSnapshot(currentPeriod.id),
				]);
				if (!isMounted || attempt !== reloadKey) {
					return;
				}

				const inputs = financeNumbersToInputs(financeSnapshot);
				setPeriod(currentPeriod);
				setGoal(periodGoal);
				setSnapshot(financeSnapshot);
				setRevenueInput(inputs.revenueInput);
				setProfitInput(inputs.profitInput);
				setMarketplaceEnabled(inputs.marketplaceEnabled);
				setMarketplaceNote(inputs.marketplaceNote);
				setLoadError(null);
				setIsLoaded(true);
			} catch (error) {
				if (!isMounted || attempt !== reloadKey) {
					return;
				}
				setPeriod(null);
				setGoal(null);
				setSnapshot(null);
				setLoadError(resolvePoemmaFinanceLoadError(error));
				setIsLoaded(true);
			}
		}

		setIsLoaded(false);
		setLoadError(null);
		void loadFinancePage(reloadKey);

		return () => {
			isMounted = false;
		};
	}, [repository, reloadKey, userRole]);

	if (!isPoemmaFinanceOwner(userRole)) {
		return <PoemmaFinanceAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем цифры прибыли"
				description="Подтягиваем цель периода и текущий факт."
			/>
		);
	}

	if (loadError) {
		return (
			<PoemmaPageError
				title="Не удалось открыть раздел прибыли"
				description={loadError}
				actions={
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={() => setReloadKey((previous) => previous + 1)}
					>
						Повторить
					</DesktopAppButton>
				}
			/>
		);
	}

	if (!period) {
		return <PoemmaFinanceNoPeriod onNavigate={onNavigate} />;
	}

	const activePeriod = period;
	const planSummary = computePoemmaProfitPlanSummary(goal, snapshot);
	const sourceBadge = snapshot
		? buildPoemmaFinanceSourceBadge(snapshot.source, snapshot.syncedAt)
		: null;

	async function handleSaveManual(
		event: FormEvent<HTMLFormElement>
	): Promise<void> {
		event.preventDefault();
		setSaveMessage(null);
		setSyncMessage(null);

		const validation = validatePoemmaFinanceDraft({
			profitInput,
			revenueInput,
		});
		if (validation) {
			setValidationError(validation);
			return;
		}

		const profit = parsePoemmaMoneyInput(profitInput);
		if (profit == null) {
			setValidationError('Укажите прибыль');
			return;
		}
		const revenueParsed = parsePoemmaMoneyInput(revenueInput);
		const revenue =
			revenueParsed != null && revenueParsed > 0 ? revenueParsed : undefined;

		setValidationError(null);
		setIsSaving(true);
		try {
			const nextSnapshot = mergePoemmaFinanceManualSave({
				existing: snapshot,
				periodId: activePeriod.id,
				revenue,
				profit,
				marketplaceNote: resolvePoemmaMarketplaceNote({
					enabled: marketplaceEnabled,
					note: marketplaceNote,
				}),
			});
			await repository.saveFinanceSnapshot(nextSnapshot);
			setSnapshot(nextSnapshot);
			setSaveMessage('Цифры сохранены');
		} finally {
			setIsSaving(false);
		}
	}

	async function handleSync1C(): Promise<void> {
		setSyncMessage(null);
		setIsSyncing(true);
		try {
			const result = await repository.syncFrom1C();
			setSyncMessage(result.message);
		} finally {
			setIsSyncing(false);
		}
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.finance}
					title="Прибыль"
					description={buildPoemmaPeriodRollingLabel(activePeriod)}
				/>

				<div className="mt-6 flex flex-wrap items-start justify-between gap-3">
					<PoemmaSectionTitle>Прибыль · 90 дней</PoemmaSectionTitle>
					{sourceBadge ? (
						<PoemmaMetricBadge
							label={sourceBadge}
							tone="neutral"
							variant="chip"
						/>
					) : null}
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2">
					<span
						className={cn(
							'text-sm font-semibold',
							planSummary.status === 'below'
								? 'text-[color-mix(in_srgb,rgb(185_28_28)_85%,var(--desktop-text-primary))]'
								: 'text-(--desktop-text-secondary)'
						)}
					>
						{planSummary.statusLabel}
					</span>
					{hasPoemmaMarketplaceFlag(snapshot) ? (
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							· {POEMMA_MARKETPLACE_FLAG_LABEL}
						</span>
					) : null}
				</div>

				<div className="mt-6">
					<PoemmaProfitPlanFactRow
						planValue={
							planSummary.plan != null
								? formatPoemmaFinanceMoneyRub(planSummary.plan)
								: '—'
						}
						factValue={
							planSummary.fact != null
								? formatPoemmaFinanceMoneyRub(planSummary.fact)
								: '—'
						}
						percentValue={
							planSummary.percent != null ? `${planSummary.percent}%` : '—'
						}
					/>
				</div>

				{snapshot?.marketplaceNote?.trim() ? (
					<p className="mt-4 text-sm leading-relaxed text-(--desktop-text-secondary)">
						{snapshot.marketplaceNote}
					</p>
				) : null}

				<form className="mt-8 grid gap-4" onSubmit={handleSaveManual}>
					<PoemmaFormField label="Выручка, ₽">
						<DesktopAppInput
							type="text"
							inputMode="decimal"
							aria-label="Выручка"
							value={revenueInput}
							onChange={(event) => {
								setRevenueInput(event.target.value);
								setValidationError(null);
								setSaveMessage(null);
							}}
						/>
					</PoemmaFormField>

					<PoemmaFormField label="Прибыль, ₽">
						<DesktopAppInput
							type="text"
							inputMode="decimal"
							aria-label="Прибыль"
							value={profitInput}
							onChange={(event) => {
								setProfitInput(event.target.value);
								setValidationError(null);
								setSaveMessage(null);
							}}
						/>
					</PoemmaFormField>

					<fieldset className="grid gap-2 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) p-4">
						<legend className="sr-only">Маркетплейс</legend>
						<label className="flex cursor-pointer items-start gap-3">
							<input
								type="checkbox"
								className="mt-1 h-4 w-4 rounded border-(--desktop-border-subtle)"
								checked={marketplaceEnabled}
								onChange={(event) => {
									setMarketplaceEnabled(event.target.checked);
									setSaveMessage(null);
								}}
								aria-label={POEMMA_MARKETPLACE_FLAG_LABEL}
							/>
							<span className="text-sm font-semibold leading-relaxed text-(--desktop-text-primary)">
								{POEMMA_MARKETPLACE_FLAG_LABEL}
							</span>
						</label>
						{marketplaceEnabled ? (
							<PoemmaFormField label="Заметка">
								<textarea
									className={POEMMA_TEXTAREA_CLASS}
									rows={3}
									aria-label="Заметка о маркетплейсе"
									value={marketplaceNote}
									onChange={(event) => {
										setMarketplaceNote(event.target.value);
										setSaveMessage(null);
									}}
									placeholder="Коротко: что продаём и почему прибыль не видна"
								/>
							</PoemmaFormField>
						) : null}
					</fieldset>

					<PoemmaFieldError message={validationError} />
					{saveMessage ? (
						<DesktopProductStatusBanner
							tone="neutral"
							title="Ручной ввод"
							description={saveMessage}
						/>
					) : null}
					{syncMessage ? (
						<DesktopProductStatusBanner
							tone="neutral"
							title="1С"
							description={syncMessage}
						/>
					) : null}

					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={isSaving}
						>
							{isSaving ? 'Сохраняем…' : 'Ввести вручную'}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="neutral"
							disabled={isSyncing}
							onClick={() => void handleSync1C()}
						>
							{isSyncing
								? POEMMA_FINANCE_COPY.sync1cProgress
								: POEMMA_FINANCE_COPY.sync1cAction}
						</DesktopAppButton>
					</div>
				</form>

				<PoemmaActionRow
					className="mt-6"
					actions={
						<DesktopAppButton
							type="button"
							variant="ghost"
							onClick={() => onNavigate('/goal')}
						>
							План →
						</DesktopAppButton>
					}
					hint="Откройте цель периода и сверьте план прибыли."
				/>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
