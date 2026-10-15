/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Six-step owner onboarding wizard (P-101…P-104): strategy, goal, segments, period activation.
 *
 * Invariants:
 * - Step validation gates navigation; incomplete mandatory fields do not move forward.
 * - Final step persists strategy, goal, and segments before period activation.
 * - Data access and persistence are routed only through getPoemmaRepository.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §1
 * - poemma/docs/implementation/COPY-RU.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppContentWrapper,
	DesktopProductStatusBanner,
	DesktopProductWorkspace,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type { PoemmaOrganization, PoemmaPeriod } from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaFormField,
	PoemmaNoticePanel,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPageShell,
	PoemmaSemanticText,
	PoemmaStepIndicator,
	PoemmaWizardFrame,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaPeriodGoalFromOnboarding,
	buildPoemmaSegmentsFromOnboarding,
	buildPoemmaStrategyAnchor,
	createEmptyPoemmaOnboardingForm,
	DEFAULT_POEMMA_ONBOARDING_SEGMENTS,
	POEMMA_ONBOARDING_MAX_VALUES,
	POEMMA_ONBOARDING_MIN_VALUES,
	POEMMA_ONBOARDING_STEP_COUNT,
	POEMMA_ONBOARDING_WELCOME_SUB,
	POEMMA_ONBOARDING_WELCOME_TITLE,
	poemmaOnboardingFormFromStrategy,
	poemmaOnboardingProgressLabel,
	type PoemmaOnboardingFormState,
	validatePoemmaOnboardingStep,
} from './poemmaOnboardingSteps';

export {
	isPoemmaStrategyEmpty,
	resolvePoemmaHomeRoute,
} from './poemmaOnboardingSteps';
export type { PoemmaOnboardingRoute } from './poemmaOnboardingSteps';

const POEMMA_ONBOARDING_VALUE_SLOT_KEYS = [
	'value-1',
	'value-2',
	'value-3',
	'value-4',
	'value-5',
] as const;

function formatPoemmaPeriodRange(period: PoemmaPeriod | null): string {
	if (!period) {
		return '90 дней с сегодня';
	}
	const formatter = new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
	});
	const start = formatter.format(new Date(`${period.startDate}T00:00:00`));
	const end = formatter.format(new Date(`${period.endDate}T00:00:00`));
	return `90 дней с сегодня (${start} – ${end})`;
}

export interface PoemmaOnboardingProps {
	ownerUserId: string;
	onComplete: () => void;
}

export function PoemmaOnboarding({
	ownerUserId,
	onComplete,
}: PoemmaOnboardingProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);

	const [step, setStep] = useState(1);
	const [form, setForm] = useState<PoemmaOnboardingFormState>(
		createEmptyPoemmaOnboardingForm
	);
	const [org, setOrg] = useState<PoemmaOrganization | null>(null);
	const [period, setPeriod] = useState<PoemmaPeriod | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		let isMounted = true;

		async function loadDraft(): Promise<void> {
			const loadedOrg = await repository.getOrg();
			if (!isMounted) {
				return;
			}
			if (!loadedOrg) {
				setOrg(null);
				setIsLoaded(true);
				return;
			}

			const loadedPeriod = await repository.getCurrentPeriod();
			const [strategy, goal, segments] = await Promise.all([
				repository.getStrategy(),
				loadedPeriod
					? repository.getPeriodGoal(loadedPeriod.id)
					: Promise.resolve(null),
				repository.listSegments(loadedOrg.id),
			]);

			if (!isMounted) {
				return;
			}

			setOrg(loadedOrg);
			setPeriod(loadedPeriod);
			setForm(poemmaOnboardingFormFromStrategy(strategy, goal, segments));
			setIsLoaded(true);
		}

		setIsLoaded(false);
		void loadDraft();

		return () => {
			isMounted = false;
		};
	}, [repository]);

	const persistStrategyForStep = useCallback(
		async (nextForm: PoemmaOnboardingFormState) => {
			if (!org) {
				return;
			}
			const existing = await repository.getStrategy();
			const strategy = buildPoemmaStrategyAnchor({
				orgId: org.id,
				ownerUserId: ownerUserId.trim(),
				form: nextForm,
				existing,
			});
			await repository.saveStrategy(strategy);
		},
		[org, ownerUserId, repository]
	);

	const goNext = useCallback(async () => {
		const validationError = validatePoemmaOnboardingStep(step, form);
		if (validationError) {
			setFieldError(validationError);
			return;
		}
		setFieldError(null);
		setIsSaving(true);
		setError(null);

		try {
			if (step === 2 || step === 3 || step === 4) {
				await persistStrategyForStep(form);
			}
			if (step === 5 && period) {
				await repository.savePeriodGoal(
					buildPoemmaPeriodGoalFromOnboarding(period.id, form)
				);
			}
			if (step < POEMMA_ONBOARDING_STEP_COUNT) {
				setStep((current) => current + 1);
				return;
			}

			if (!org || !period) {
				setError('Сначала создайте основу карты');
				return;
			}

			const strategy = buildPoemmaStrategyAnchor({
				orgId: org.id,
				ownerUserId: ownerUserId.trim(),
				form,
				existing: await repository.getStrategy(),
			});
			await repository.saveStrategy(strategy);
			await repository.savePeriodGoal(
				buildPoemmaPeriodGoalFromOnboarding(period.id, form)
			);
			await repository.saveSegments(
				org.id,
				buildPoemmaSegmentsFromOnboarding(org.id, form)
			);

			if (period.status === 'draft') {
				await repository.activatePeriod(period.id);
			}

			onComplete();
		} catch (cause) {
			const message =
				cause instanceof Error ? cause.message : 'Не удалось сохранить';
			setError(message);
		} finally {
			setIsSaving(false);
		}
	}, [
		form,
		onComplete,
		org,
		ownerUserId,
		period,
		persistStrategyForStep,
		repository,
		step,
	]);

	const goBack = useCallback(() => {
		setFieldError(null);
		setStep((current) => Math.max(1, current - 1));
	}, []);

	const updateValue = useCallback((index: number, value: string) => {
		setForm((current) => {
			const values = [...current.values];
			values[index] = value;
			return { ...current, values };
		});
	}, []);

	const addValueRow = useCallback(() => {
		setForm((current) => {
			if (current.values.length >= POEMMA_ONBOARDING_MAX_VALUES) {
				return current;
			}
			return { ...current, values: [...current.values, ''] };
		});
	}, []);

	const updateSegment = useCallback(
		(
			index: number,
			patch: Partial<{
				name: string;
				sharePercent: number;
			}>
		) => {
			setForm((current) => {
				const segments = current.segments.map((segment, segmentIndex) =>
					segmentIndex === index ? { ...segment, ...patch } : segment
				);
				return { ...current, segments };
			});
		},
		[]
	);

	const segmentTotal = form.segments.reduce(
		(sum, segment) =>
			sum + (Number.isFinite(segment.sharePercent) ? segment.sharePercent : 0),
		0
	);

	const primaryButtonLabel =
		step === 1
			? 'Начать'
			: step === POEMMA_ONBOARDING_STEP_COUNT
				? 'Показать карту'
				: 'Далее';

	if (!isLoaded) {
		return (
			<DesktopAppContentWrapper
				appComponent="PoemmaOnboarding"
				mode="passthrough"
				className="h-full min-h-0 overflow-hidden"
			>
				<div className="grid min-h-112 place-items-center p-6">
					<PoemmaPageLoading
						title="Загружаем онбординг"
						description="Проверяем черновик карты и шаги заполнения."
					/>
				</div>
			</DesktopAppContentWrapper>
		);
	}

	if (!org) {
		return (
			<DesktopAppContentWrapper
				appComponent="PoemmaOnboarding"
				mode="passthrough"
				className="h-full min-h-0 overflow-hidden"
			>
				<div className="grid min-h-112 place-items-center p-6">
					<PoemmaPageShell className="w-full place-items-center">
						<PoemmaNoticePanel
							className="w-full"
							tone="warning"
							title="Нет основы карты"
							description="Сначала создайте бизнес и черновик периода, затем вернитесь к онбордингу."
						/>
					</PoemmaPageShell>
				</div>
			</DesktopAppContentWrapper>
		);
	}

	return (
		<DesktopAppContentWrapper
			appComponent="PoemmaOnboarding"
			mode="passthrough"
			className="h-full min-h-0 overflow-hidden"
		>
			<DesktopProductWorkspace
				header={
					<PoemmaPageHeader
						eyebrow={POEMMA_SECTION_EYEBROW.onboarding}
						title={POEMMA_ONBOARDING_WELCOME_TITLE}
						description="Смысл, цель и кто покупает — только ваши данные."
						meta={
							<p className="text-sm font-semibold text-(--desktop-text-secondary)">
								{poemmaOnboardingProgressLabel(step)}
							</p>
						}
					/>
				}
			>
				<PoemmaWizardFrame
					stepIndicator={
						<PoemmaStepIndicator
							filled={step}
							total={POEMMA_ONBOARDING_STEP_COUNT}
							ariaLabel={poemmaOnboardingProgressLabel(step)}
						/>
					}
					progressLabel={poemmaOnboardingProgressLabel(step)}
					footer={
						<>
							{step > 1 ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									disabled={isSaving}
									onClick={goBack}
								>
									Назад
								</DesktopAppButton>
							) : (
								<span />
							)}
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={isSaving}
								onClick={() => void goNext()}
							>
								{isSaving ? 'Сохраняем…' : primaryButtonLabel}
							</DesktopAppButton>
						</>
					}
				>
					{error ? (
						<DesktopProductStatusBanner
							tone="warning"
							title="Ошибка"
							description={error}
						/>
					) : null}

					{fieldError ? (
						<DesktopProductStatusBanner
							tone="warning"
							title="Проверьте поля"
							description={fieldError}
						/>
					) : null}

					{step === 1 ? (
						<div className="space-y-4 text-center">
							<PoemmaSectionTitle>Старт</PoemmaSectionTitle>
							<h2 className="text-3xl font-semibold tracking-tight text-(--desktop-text-primary)">
								{POEMMA_ONBOARDING_WELCOME_TITLE}
							</h2>
							<p className="text-base leading-7 text-(--desktop-text-secondary)">
								{POEMMA_ONBOARDING_WELCOME_SUB}
							</p>
							<p className="text-sm text-(--desktop-text-muted)">
								Цифры из 1С. Смысл — ваш.
							</p>
						</div>
					) : null}

					{step === 2 ? (
						<div className="space-y-4">
							<PoemmaSectionTitle>Зачем бизнес</PoemmaSectionTitle>
							<PoemmaFormField label="Видение" htmlFor="poemma-vision">
								<textarea
									id="poemma-vision"
									rows={4}
									className={cn(POEMMA_TEXTAREA_CLASS, 'min-h-24')}
									placeholder="Как вижу бизнес через 5 лет…"
									value={form.vision}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											vision: event.target.value,
										}))
									}
								/>
							</PoemmaFormField>
							<PoemmaFormField label="Миссия" htmlFor="poemma-mission">
								<textarea
									id="poemma-mission"
									rows={3}
									className={cn(POEMMA_TEXTAREA_CLASS, 'min-h-24')}
									placeholder="Зачем мы не спим…"
									value={form.mission}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											mission: event.target.value,
										}))
									}
								/>
							</PoemmaFormField>
						</div>
					) : null}

					{step === 3 ? (
						<div className="space-y-4">
							<PoemmaSectionTitle>Ценности</PoemmaSectionTitle>
							<p className="text-sm text-(--desktop-text-secondary)">
								От {POEMMA_ONBOARDING_MIN_VALUES} до{' '}
								{POEMMA_ONBOARDING_MAX_VALUES} коротких формулировок
							</p>
							{form.values.map((value, index) => (
								<PoemmaFormField
									key={
										POEMMA_ONBOARDING_VALUE_SLOT_KEYS[index] ??
										`value-${index + 1}`
									}
									label={`Ценность ${index + 1}`}
									htmlFor={`poemma-value-${index}`}
								>
									<DesktopAppInput
										id={`poemma-value-${index}`}
										value={value}
										onChange={(event) => updateValue(index, event.target.value)}
									/>
								</PoemmaFormField>
							))}
							{form.values.length < POEMMA_ONBOARDING_MAX_VALUES ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={addValueRow}
								>
									+ Ещё
								</DesktopAppButton>
							) : null}
						</div>
					) : null}

					{step === 4 ? (
						<div className="space-y-4">
							<PoemmaSectionTitle>УТП</PoemmaSectionTitle>
							<PoemmaFormField label="Чем мы отличаемся?" htmlFor="poemma-utp">
								<textarea
									id="poemma-utp"
									rows={3}
									className={cn(POEMMA_TEXTAREA_CLASS, 'min-h-24')}
									value={form.utp}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											utp: event.target.value,
										}))
									}
								/>
							</PoemmaFormField>
							<p className="text-sm text-(--desktop-text-muted)">
								Одно предложение, без жаргона.
							</p>
						</div>
					) : null}

					{step === 5 ? (
						<div className="space-y-4">
							<PoemmaSectionTitle>Цель 90 дней</PoemmaSectionTitle>
							<p className="text-sm text-(--desktop-text-secondary)">
								Период: {formatPoemmaPeriodRange(period)}
							</p>
							<PoemmaFormField label="Прибыль план" htmlFor="poemma-profit">
								<div className="flex items-center gap-2">
									<DesktopAppInput
										id="poemma-profit"
										type="number"
										min={1}
										inputMode="decimal"
										value={form.targetProfit}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												targetProfit: event.target.value,
											}))
										}
									/>
									<span className="text-sm font-semibold text-(--desktop-text-secondary)">
										₽
									</span>
								</div>
							</PoemmaFormField>
						</div>
					) : null}

					{step === 6 ? (
						<div className="space-y-4">
							<PoemmaSectionTitle>Кто покупает</PoemmaSectionTitle>
							<div className="space-y-3">
								{form.segments.map((segment, index) => (
									<div
										key={segment.id ?? `segment-row-${index}`}
										className="grid gap-2 sm:grid-cols-[1fr_6rem]"
									>
										<PoemmaFormField
											label="Сегмент"
											htmlFor={`poemma-segment-name-${index}`}
										>
											<DesktopAppInput
												id={`poemma-segment-name-${index}`}
												value={segment.name}
												onChange={(event) =>
													updateSegment(index, {
														name: event.target.value,
													})
												}
											/>
										</PoemmaFormField>
										<PoemmaFormField
											label="Доля %"
											htmlFor={`poemma-segment-share-${index}`}
										>
											<DesktopAppInput
												id={`poemma-segment-share-${index}`}
												type="number"
												min={0}
												max={100}
												value={segment.sharePercent}
												onChange={(event) =>
													updateSegment(index, {
														sharePercent:
															Number.parseInt(event.target.value, 10) || 0,
													})
												}
											/>
										</PoemmaFormField>
									</div>
								))}
							</div>
							{segmentTotal !== 100 ? (
								<PoemmaSemanticText tone="warning" className="text-sm">
									Сумма {segmentTotal}% — нужно 100%
								</PoemmaSemanticText>
							) : (
								<p className="text-sm text-(--desktop-text-muted)">
									Сумма 100%
								</p>
							)}
							<DesktopAppButton
								type="button"
								variant="neutral"
								onClick={() =>
									setForm((current) => ({
										...current,
										segments: DEFAULT_POEMMA_ONBOARDING_SEGMENTS.map(
											(segment) => ({ ...segment })
										),
									}))
								}
							>
								Сбросить доли
							</DesktopAppButton>
						</div>
					) : null}
				</PoemmaWizardFrame>
			</DesktopProductWorkspace>
		</DesktopAppContentWrapper>
	);
}

export default PoemmaOnboarding;
