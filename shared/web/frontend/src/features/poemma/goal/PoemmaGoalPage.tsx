/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only /goal screen: rolling 90-day period label, profit plan (PERIOD_GOAL), CTA to finance.
 *
 * Invariants:
 * - Profit target must be > 0 before save.
 * - Data access only via getPoemmaRepository (no direct localStorage).
 * - Team roles see an access notice, not profit planning.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §4
 * - poemma/docs/architecture/marketing-cabinet-backlog.md P-107
 * - src/features/poemma/ui/ (wave-4 page shell)
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
	DesktopAppButton,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	PoemmaPeriod,
	PoemmaPeriodGoal,
	PoemmaUserRole,
} from '../poemmaDomain';
import {
	POEMMA_PAGE_DESCRIPTION,
	POEMMA_SECTION_EYEBROW,
} from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaFieldError,
	PoemmaFormField,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaAccessDenied,
	PoemmaPageShell,
	PoemmaSectionTitle,
} from '../ui';

export interface PoemmaGoalPageProps {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
}

function formatPoemmaPeriodDate(date: string): string {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
	}).format(new Date(`${date}T00:00:00.000Z`));
}

export function buildPoemmaPeriodRollingLabel(
	period: PoemmaPeriod | null
): string {
	if (!period) {
		return '90 дней · с сегодня';
	}
	return `90 дней · с ${formatPoemmaPeriodDate(period.startDate)}`;
}

function buildPoemmaPeriodRangeLabel(period: PoemmaPeriod): string {
	return `${formatPoemmaPeriodDate(period.startDate)} – ${formatPoemmaPeriodDate(period.endDate)}`;
}

function formatPoemmaMoneyRub(value: number): string {
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value);
}

function parsePoemmaProfitInput(raw: string): number | null {
	const normalized = raw.replace(/\s/g, '').replace(',', '.');
	if (!normalized) {
		return null;
	}
	const value = Number(normalized);
	return Number.isFinite(value) ? value : null;
}

function createDefaultPoemmaPeriodGoal(periodId: string): PoemmaPeriodGoal {
	return {
		periodId,
		primaryMetricType: 'profit',
		primaryMetricLabel: 'Прибыль',
	};
}

function PoemmaGoalAccessDenied() {
	return (
		<PoemmaAccessDenied description="Команда видит только задачи, опыт и нужные ветки. Цель по прибыли доступна собственнику." />
	);
}

function PoemmaGoalNoPeriod({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет периода</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					Сначала создайте основу бизнеса на карте — появится черновик периода
					90 дней.
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

export function PoemmaGoalPage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaGoalPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [period, setPeriod] = useState<PoemmaPeriod | null>(null);
	const [goal, setGoal] = useState<PoemmaPeriodGoal | null>(null);
	const [planInput, setPlanInput] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (userRole !== 'owner') {
			setIsLoaded(true);
			return;
		}

		let isMounted = true;

		async function loadGoalPage(): Promise<void> {
			const currentPeriod = await repository.getCurrentPeriod();
			if (!isMounted) {
				return;
			}
			if (!currentPeriod) {
				setPeriod(null);
				setGoal(null);
				setPlanInput('');
				setIsLoaded(true);
				return;
			}

			const periodGoal = await repository.getPeriodGoal(currentPeriod.id);
			if (!isMounted) {
				return;
			}

			setPeriod(currentPeriod);
			setGoal(periodGoal);
			setPlanInput(
				periodGoal?.targetProfit != null && periodGoal.targetProfit > 0
					? String(periodGoal.targetProfit)
					: ''
			);
			setIsLoaded(true);
		}

		setIsLoaded(false);
		void loadGoalPage();

		return () => {
			isMounted = false;
		};
	}, [repository, userRole]);

	if (userRole !== 'owner') {
		return <PoemmaGoalAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем цель на 90 дней"
				description="Проверяем текущий период и сохранённый план прибыли."
			/>
		);
	}

	if (!period) {
		return <PoemmaGoalNoPeriod onNavigate={onNavigate} />;
	}

	const activePeriod = period;
	const savedTarget = goal?.targetProfit ?? 0;
	const hasSavedPlan = savedTarget > 0;

	async function handleSavePlan(
		event: FormEvent<HTMLFormElement>
	): Promise<void> {
		event.preventDefault();
		setSaveMessage(null);
		const targetProfit = parsePoemmaProfitInput(planInput);
		if (targetProfit == null || targetProfit <= 0) {
			setValidationError('Укажите прибыль больше нуля');
			return;
		}

		setValidationError(null);
		setIsSaving(true);
		try {
			const nextGoal: PoemmaPeriodGoal = {
				...createDefaultPoemmaPeriodGoal(activePeriod.id),
				...goal,
				periodId: activePeriod.id,
				primaryMetricType: 'profit',
				primaryMetricLabel: 'Прибыль',
				targetProfit,
			};
			await repository.savePeriodGoal(nextGoal);
			setGoal(nextGoal);
			setSaveMessage('План сохранён');
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.goal}
					title="Цель 90 дней"
					description={POEMMA_PAGE_DESCRIPTION.goal}
				/>

				<PoemmaPageSection label="Период" spacing="compact" variant="framed">
					<p className="text-sm font-semibold text-(--desktop-text-secondary)">
						{buildPoemmaPeriodRollingLabel(activePeriod)}
					</p>
					<p className="text-3xl font-semibold tracking-tight text-(--desktop-text-primary)">
						{buildPoemmaPeriodRangeLabel(activePeriod)}
					</p>
				</PoemmaPageSection>

				<PoemmaPageSection label="Прибыль" spacing="compact" variant="framed">
					{hasSavedPlan ? (
						<p className="text-4xl font-semibold tracking-tight text-(--desktop-text-primary)">
							{formatPoemmaMoneyRub(savedTarget)}
						</p>
					) : (
						<p className="text-base leading-7 text-(--desktop-text-secondary)">
							Задайте план прибыли на скользящие 90 дней.
						</p>
					)}

					<form className="grid gap-3" onSubmit={handleSavePlan}>
						<PoemmaFormField label="План, ₽">
							<DesktopAppInput
								type="text"
								inputMode="decimal"
								aria-label="План прибыли"
								value={planInput}
								onChange={(event) => {
									setPlanInput(event.target.value);
									setValidationError(null);
									setSaveMessage(null);
								}}
							/>
						</PoemmaFormField>
						<PoemmaFieldError message={validationError} />
						{saveMessage ? (
							<p className="text-sm font-semibold text-(--desktop-text-secondary)">
								{saveMessage}
							</p>
						) : null}
						<PoemmaActionRow
							actions={
								<>
									<DesktopAppButton
										type="submit"
										variant="accent"
										disabled={isSaving}
									>
										{isSaving ? 'Сохраняем…' : 'Сохранить план'}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="neutral"
										onClick={() => onNavigate('/finance')}
									>
										Ввести факт
									</DesktopAppButton>
								</>
							}
						/>
					</form>
				</PoemmaPageSection>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
