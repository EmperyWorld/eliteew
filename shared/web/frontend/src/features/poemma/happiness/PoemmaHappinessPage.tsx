/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Experience screen (P-302…P-306): employee/client scores, balance status, happiness signals CRUD.
 *
 * Invariants:
 * - Owner edits scores and reviews; team sees read-only balance and feed (P-306).
 * - Repository is the only data access path.
 * - inBalance is recomputed on save via domain threshold (default 5%).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §8
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type FormEvent,
} from 'react';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppModalFrame,
	DesktopNativeSelect,
	DesktopPortaledConfirmShell,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	PoemmaCustomerSegment,
	PoemmaExperienceBalance,
	PoemmaHappinessSignal,
	PoemmaHappinessSignalType,
	PoemmaOrganization,
	PoemmaUserRole,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaFieldError,
	PoemmaFormField,
	PoemmaListRow,
	PoemmaMetricBadge,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaPageShell,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaExperienceBalance,
	formatPoemmaExperienceScore,
	resolvePoemmaExperienceStatusLabel,
} from './poemmaExperience';
import {
	createPoemmaHappinessSignalId,
	formatPoemmaHappinessSignalLine,
	isPoemmaHappinessOwner,
	POEMMA_HAPPINESS_NEGATIVE_TYPES,
	POEMMA_HAPPINESS_POSITIVE_TYPES,
	POEMMA_HAPPINESS_SIGNAL_TYPE_LABELS,
	parsePoemmaExperienceScoreInput,
	validatePoemmaHappinessSignalDraft,
} from './poemmaHappinessForm';

export interface PoemmaHappinessPageProps {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
}

function PoemmaHappinessNoOrg({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет бизнеса</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					Сначала создайте основу на карте — появится экран опыта.
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

function PoemmaExperienceScaleBar({
	label,
	score,
	hint,
}: {
	label: string;
	score: number;
	hint?: string;
}) {
	const clamped = Math.min(100, Math.max(0, score));
	return (
		<div className="grid gap-2">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<span className="text-sm font-semibold text-(--desktop-text-secondary)">
					{label}
				</span>
				<span className="text-2xl font-semibold tabular-nums text-(--desktop-text-primary)">
					{formatPoemmaExperienceScore(clamped)}
				</span>
			</div>
			<div
				className="h-3 overflow-hidden rounded-full bg-(--desktop-border-subtle)"
				role="progressbar"
				aria-valuenow={clamped}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={`${label}: ${clamped} из 100`}
			>
				<div
					className="h-full rounded-full bg-[rgb(var(--desktop-accent-rgb))] transition-[width]"
					style={{ width: `${clamped}%` }}
				/>
			</div>
			{hint ? (
				<p className="text-xs font-medium text-(--desktop-text-muted)">
					{hint}
				</p>
			) : null}
		</div>
	);
}

function PoemmaHappinessHowModal({ onClose }: { onClose: () => void }) {
	return (
		<DesktopPortaledConfirmShell
			onDismiss={onClose}
			zIndex={{ backdrop: 1200, content: 1210 }}
			dismissAriaLabel="Закрыть подсказку"
			contentClassName="flex items-start justify-center p-4"
		>
			<DesktopAppModalFrame
				title="Как считаем"
				onClose={onClose}
				className="w-full max-w-md"
			>
				<div className="grid gap-3 p-4 text-sm leading-relaxed text-(--desktop-text-secondary)">
					<p>
						Счастье — когда опыт команды и клиентов совпадает. Сравниваем две
						шкалы от 0 до 100.
					</p>
					<p>
						Если разница не больше порога (по умолчанию 5% от среднего) — статус
						«В балансе». Иначе — «Есть разрыв».
					</p>
				</div>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	);
}

type SignalDraft = {
	id?: string;
	type: PoemmaHappinessSignalType;
	text: string;
	segmentId?: string;
};

function PoemmaHappinessSignalForm({
	draft,
	segments,
	validationError,
	isSaving,
	onChange,
	onSubmit,
	onClose,
}: {
	draft: SignalDraft;
	segments: PoemmaCustomerSegment[];
	validationError: string | null;
	isSaving: boolean;
	onChange: (next: SignalDraft) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onClose: () => void;
}) {
	const typeOptions = (
		Object.entries(POEMMA_HAPPINESS_SIGNAL_TYPE_LABELS) as [
			PoemmaHappinessSignalType,
			string,
		][]
	).map(([value, label]) => ({ value, label }));

	return (
		<DesktopPortaledConfirmShell
			onDismiss={onClose}
			zIndex={{ backdrop: 1200, content: 1210 }}
			dismissAriaLabel="Закрыть форму отзыва"
			contentClassName="flex items-start justify-center p-4"
		>
			<DesktopAppModalFrame
				title={draft.id ? 'Отзыв' : 'Новый отзыв'}
				onClose={onClose}
				className="w-full max-w-lg"
			>
				<form className="grid gap-4 p-4" onSubmit={onSubmit}>
					<div className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Тип
						</span>
						<DesktopNativeSelect
							aria-label="Тип отзыва"
							value={draft.type}
							onChange={(event) =>
								onChange({
									...draft,
									type: event.target.value as PoemmaHappinessSignalType,
								})
							}
						>
							{typeOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</DesktopNativeSelect>
					</div>

					<label className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Текст
						</span>
						<textarea
							className={POEMMA_TEXTAREA_CLASS}
							aria-label="Текст отзыва"
							rows={4}
							value={draft.text}
							onChange={(event) =>
								onChange({ ...draft, text: event.target.value })
							}
						/>
					</label>

					<div className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Сегмент
						</span>
						<DesktopNativeSelect
							aria-label="Сегмент покупателя"
							value={draft.segmentId ?? ''}
							onChange={(event) =>
								onChange({
									...draft,
									segmentId: event.target.value || undefined,
								})
							}
						>
							<option value="">Без сегмента</option>
							{segments.map((segment) => (
								<option key={segment.id} value={segment.id}>
									{segment.name}
								</option>
							))}
						</DesktopNativeSelect>
					</div>

					{validationError ? (
						<PoemmaFieldError message={validationError} />
					) : null}

					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={isSaving}
						>
							{isSaving ? 'Сохраняем…' : 'Сохранить'}
						</DesktopAppButton>
						<DesktopAppButton type="button" variant="neutral" onClick={onClose}>
							Отмена
						</DesktopAppButton>
					</div>
				</form>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	);
}

export function PoemmaHappinessPage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaHappinessPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const canEdit = isPoemmaHappinessOwner(userRole);

	const [org, setOrg] = useState<PoemmaOrganization | null>(null);
	const [balance, setBalance] = useState<PoemmaExperienceBalance | null>(null);
	const [signals, setSignals] = useState<PoemmaHappinessSignal[]>([]);
	const [segments, setSegments] = useState<PoemmaCustomerSegment[]>([]);
	const [thresholdPercent, setThresholdPercent] = useState(5);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isEditingScores, setIsEditingScores] = useState(false);
	const [employeeInput, setEmployeeInput] = useState('');
	const [clientInput, setClientInput] = useState('');
	const [scoreError, setScoreError] = useState<string | null>(null);
	const [isSavingScores, setIsSavingScores] = useState(false);
	const [showHowModal, setShowHowModal] = useState(false);
	const [signalDraft, setSignalDraft] = useState<SignalDraft | null>(null);
	const [signalError, setSignalError] = useState<string | null>(null);
	const [isSavingSignal, setIsSavingSignal] = useState(false);

	const reload = useCallback(async () => {
		const currentOrg = await repository.getOrg();
		if (!currentOrg) {
			setOrg(null);
			setBalance(null);
			setSignals([]);
			setSegments([]);
			setIsLoaded(true);
			return;
		}

		const [settings, experience, happinessSignals, customerSegments] =
			await Promise.all([
				repository.getOrgSettings(),
				repository.getExperienceBalance(currentOrg.id),
				repository.listHappinessSignals(currentOrg.id),
				repository.listSegments(currentOrg.id),
			]);

		setOrg(currentOrg);
		setBalance(experience);
		setSignals(happinessSignals);
		setSegments(customerSegments);
		setThresholdPercent(settings?.experienceBalanceThresholdPercent ?? 5);
		setEmployeeInput(experience ? String(experience.employeeScore) : '');
		setClientInput(experience ? String(experience.clientScore) : '');
		setIsLoaded(true);
	}, [repository]);

	useEffect(() => {
		setIsLoaded(false);
		void reload();
	}, [reload]);

	async function handleSaveScores(
		event: FormEvent<HTMLFormElement>
	): Promise<void> {
		event.preventDefault();
		if (!org || !canEdit) {
			return;
		}

		const employeeScore = parsePoemmaExperienceScoreInput(employeeInput);
		const clientScore = parsePoemmaExperienceScoreInput(clientInput);
		if (employeeScore == null || clientScore == null) {
			setScoreError('Укажите оценки от 0 до 100');
			return;
		}

		setScoreError(null);
		setIsSavingScores(true);
		try {
			const next = buildPoemmaExperienceBalance({
				orgId: org.id,
				employeeScore,
				clientScore,
				thresholdPercent,
			});
			await repository.saveExperienceBalance(next);
			setBalance(next);
			setIsEditingScores(false);
		} finally {
			setIsSavingScores(false);
		}
	}

	function openSignalForm(type: PoemmaHappinessSignalType): void {
		setSignalError(null);
		setSignalDraft({ type, text: '', segmentId: undefined });
	}

	async function handleSaveSignal(
		event: FormEvent<HTMLFormElement>
	): Promise<void> {
		event.preventDefault();
		if (!org || !signalDraft || !canEdit) {
			return;
		}

		const validation = validatePoemmaHappinessSignalDraft(signalDraft);
		if (validation) {
			setSignalError(validation);
			return;
		}

		setSignalError(null);
		setIsSavingSignal(true);
		try {
			const signal: PoemmaHappinessSignal = {
				id: signalDraft.id ?? createPoemmaHappinessSignalId(),
				orgId: org.id,
				type: signalDraft.type,
				text: signalDraft.text.trim(),
				segmentId: signalDraft.segmentId,
				createdAt: signalDraft.id
					? (signals.find((item) => item.id === signalDraft.id)?.createdAt ??
						new Date().toISOString())
					: new Date().toISOString(),
			};
			await repository.saveHappinessSignal(signal);
			setSignalDraft(null);
			await reload();
		} finally {
			setIsSavingSignal(false);
		}
	}

	async function handleDeleteSignal(signalId: string): Promise<void> {
		if (!org || !canEdit) {
			return;
		}
		await repository.deleteHappinessSignal(org.id, signalId);
		await reload();
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем экран опыта"
				description="Подтягиваем баланс команды и клиентские сигналы."
			/>
		);
	}

	if (!org) {
		return <PoemmaHappinessNoOrg onNavigate={onNavigate} />;
	}

	const statusLabel = balance
		? resolvePoemmaExperienceStatusLabel(balance.inBalance)
		: 'Нет оценок';
	const employeeScore = balance?.employeeScore ?? 0;
	const clientScore = balance?.clientScore ?? 0;

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			{!canEdit ? (
				<DesktopProductStatusBanner
					tone="neutral"
					title="Только просмотр"
					description="Команда видит баланс опыта и отзывы. Изменить оценки может собственник."
				/>
			) : null}

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.happiness}
					title="Опыт совпал?"
					description="Сравниваем шкалы команды и клиентов. Разрыв больше порога — сигнал к действию."
					meta={
						<PoemmaMetricBadge
							label={statusLabel}
							tone={balance?.inBalance ? 'success' : 'warning'}
						/>
					}
					actions={
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setShowHowModal(true)}
						>
							Как считаем?
						</DesktopAppButton>
					}
				/>

				<div className="mt-6 grid gap-6">
					{balance ? (
						<div className="grid gap-5">
							<PoemmaExperienceScaleBar
								label="Команда"
								score={employeeScore}
								hint={canEdit ? undefined : 'Оценку вводит собственник'}
							/>
							<PoemmaExperienceScaleBar
								label="Клиент"
								score={clientScore}
								hint="Из отзывов и ручной оценки"
							/>
						</div>
					) : (
						<DesktopAppEmptyState
							title="Нет оценок опыта"
							description="Задайте шкалы команды и клиентов — карта покажет баланс или разрыв."
						>
							{canEdit ? (
								<DesktopAppButton
									type="button"
									variant="accent"
									onClick={() => setIsEditingScores(true)}
								>
									Задать оценки
								</DesktopAppButton>
							) : null}
						</DesktopAppEmptyState>
					)}

					<PoemmaActionRow
						align="between"
						actions={
							canEdit && balance && !isEditingScores ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={() => setIsEditingScores(true)}
								>
									Изменить
								</DesktopAppButton>
							) : null
						}
					/>

					{canEdit && (isEditingScores || !balance) ? (
						<form className="grid gap-3" onSubmit={handleSaveScores}>
							<PoemmaFormField label="Команда, 0–100">
								<DesktopAppInput
									type="text"
									inputMode="numeric"
									aria-label="Опыт команды"
									value={employeeInput}
									onChange={(event) => {
										setEmployeeInput(event.target.value);
										setScoreError(null);
									}}
								/>
							</PoemmaFormField>
							<PoemmaFormField label="Клиент, 0–100">
								<DesktopAppInput
									type="text"
									inputMode="numeric"
									aria-label="Опыт клиента"
									value={clientInput}
									onChange={(event) => {
										setClientInput(event.target.value);
										setScoreError(null);
									}}
								/>
							</PoemmaFormField>
							{scoreError ? <PoemmaFieldError message={scoreError} /> : null}
							<div className="flex flex-wrap gap-2">
								<DesktopAppButton
									type="submit"
									variant="accent"
									disabled={isSavingScores}
								>
									{isSavingScores ? 'Сохраняем…' : 'Сохранить оценки'}
								</DesktopAppButton>
								{balance ? (
									<DesktopAppButton
										type="button"
										variant="neutral"
										onClick={() => {
											setIsEditingScores(false);
											setEmployeeInput(String(employeeScore));
											setClientInput(String(clientScore));
											setScoreError(null);
										}}
									>
										Отмена
									</DesktopAppButton>
								) : null}
							</div>
						</form>
					) : null}
				</div>
			</PoemmaPagePanel>

			<PoemmaPagePanel>
				<PoemmaPageSection
					label="Отзывы"
					spacing="none"
					action={
						canEdit ? (
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								onClick={() => openSignalForm('review')}
							>
								+ Добавить
							</DesktopAppButton>
						) : undefined
					}
				>
					{canEdit ? (
						<div className="mt-4 flex flex-wrap gap-2">
							{POEMMA_HAPPINESS_POSITIVE_TYPES.map((type) => (
								<DesktopAppButton
									key={type}
									type="button"
									variant="neutral"
									size="sm"
									onClick={() => openSignalForm(type)}
								>
									+ {POEMMA_HAPPINESS_SIGNAL_TYPE_LABELS[type]}
								</DesktopAppButton>
							))}
							{POEMMA_HAPPINESS_NEGATIVE_TYPES.map((type) => (
								<DesktopAppButton
									key={type}
									type="button"
									variant="neutral"
									size="sm"
									onClick={() => openSignalForm(type)}
								>
									− {POEMMA_HAPPINESS_SIGNAL_TYPE_LABELS[type]}
								</DesktopAppButton>
							))}
						</div>
					) : null}

					<div className="mt-4 grid gap-2">
						{signals.length === 0 ? (
							<DesktopAppEmptyState
								title="Нет отзывов"
								description="Добавьте отзыв или жалобу — они помогают видеть опыт клиента."
							>
								{canEdit ? (
									<DesktopAppButton
										type="button"
										variant="accent"
										onClick={() => openSignalForm('review')}
									>
										+ Отзыв
									</DesktopAppButton>
								) : null}
							</DesktopAppEmptyState>
						) : (
							signals.map((signal) => {
								const line = formatPoemmaHappinessSignalLine(signal, segments);
								return (
									<PoemmaListRow
										key={signal.id}
										className="flex flex-wrap items-start justify-between gap-3"
									>
										<div className="min-w-0 flex-1">
											<p className="text-sm text-(--desktop-text-primary)">
												<span className="font-semibold tabular-nums text-(--desktop-text-muted)">
													{line.dateLabel}
												</span>{' '}
												«{line.text}»
											</p>
											{line.segmentLabel ? (
												<p className="mt-1 text-xs font-semibold text-(--desktop-text-muted)">
													{line.segmentLabel}
												</p>
											) : null}
										</div>
										{canEdit ? (
											<div className="flex shrink-0 gap-2">
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => {
														setSignalError(null);
														setSignalDraft({
															id: signal.id,
															type: signal.type,
															text: signal.text,
															segmentId: signal.segmentId,
														});
													}}
												>
													Править
												</DesktopAppButton>
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => void handleDeleteSignal(signal.id)}
												>
													Удалить
												</DesktopAppButton>
											</div>
										) : null}
									</PoemmaListRow>
								);
							})
						)}
					</div>
				</PoemmaPageSection>

				{canEdit ? (
					<DesktopAppButton
						type="button"
						variant="accent"
						className="mt-4"
						onClick={() => openSignalForm('review')}
					>
						+ Добавить отзыв
					</DesktopAppButton>
				) : null}
			</PoemmaPagePanel>

			{showHowModal ? (
				<PoemmaHappinessHowModal onClose={() => setShowHowModal(false)} />
			) : null}

			{signalDraft && canEdit ? (
				<PoemmaHappinessSignalForm
					draft={signalDraft}
					segments={segments}
					validationError={signalError}
					isSaving={isSavingSignal}
					onChange={setSignalDraft}
					onSubmit={handleSaveSignal}
					onClose={() => setSignalDraft(null)}
				/>
			) : null}
		</PoemmaPageShell>
	);
}
