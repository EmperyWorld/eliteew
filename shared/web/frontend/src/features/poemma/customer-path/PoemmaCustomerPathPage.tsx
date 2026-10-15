/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Customer path screen (P-403, P-404, P-410): stage chain новый→постоянный, pain notes,
 * manual churn MVP, retention ideas list, empty states per wireframes §7 and §19.
 *
 * Invariants:
 * - Data only via getPoemmaRepository; list titles ≤5 words.
 * - + Идея navigates to /ideas (ideas module not owned here).
 * - No marketing-dashboard jargon.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §7
 * - src/features/poemma/poemmaRepository.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	poemmaCustomerPathPainLabel,
	poemmaInitiativeStatusLabel,
	type PoemmaChurnSnapshot,
	type PoemmaCustomerPath,
	type PoemmaCustomerPathStage,
	type PoemmaInitiative,
	type PoemmaUserRole,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaEyebrowLabel,
	PoemmaFormField,
	PoemmaListRow,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaPageShell,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';

export type PoemmaCustomerPathPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
};

function poemmaShortListTitle(title: string): string {
	const words = title.trim().split(/\s+/).filter(Boolean);
	return words.slice(0, 5).join(' ');
}

function parsePoemmaChurnInput(raw: string): number | null {
	const normalized = raw.replace(/\s/g, '').replace(',', '.');
	if (!normalized) {
		return null;
	}
	const value = Number(normalized);
	if (!Number.isFinite(value) || value < 0) {
		return null;
	}
	return Math.round(value);
}

function hasPoemmaChurnValue(snapshot: PoemmaChurnSnapshot | null): boolean {
	return (
		snapshot != null &&
		snapshot.churnPerMonth != null &&
		Number.isFinite(snapshot.churnPerMonth)
	);
}

function PoemmaCustomerPathStageChain({
	stages,
	canEdit,
	onToggleReached,
}: {
	stages: PoemmaCustomerPathStage[];
	canEdit: boolean;
	onToggleReached: (stageId: string) => void;
}) {
	return (
		<div className="overflow-x-auto pb-1">
			<div className="flex min-w-max items-start gap-2">
				{stages.map((stage, index) => (
					<div key={stage.id} className="flex items-start gap-2">
						<button
							type="button"
							disabled={!canEdit}
							onClick={() => onToggleReached(stage.id)}
							className={cn(
								'flex w-[5.5rem] flex-col items-center gap-2 rounded-(--desktop-radius-lg) border px-2 py-3 text-center transition-colors',
								canEdit
									? 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) hover:border-(--desktop-border-strong)'
									: 'cursor-default border-(--desktop-border-subtle) bg-(--desktop-surface-soft) opacity-90',
								stage.reached &&
									'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.08)]'
							)}
							aria-pressed={!!stage.reached}
							aria-label={`${stage.name}${stage.reached ? ', пройден' : ''}`}
						>
							<span className="text-xs font-semibold leading-tight text-(--desktop-text-primary)">
								{stage.name}
							</span>
							<span
								className={cn(
									'inline-block h-3 w-3 rounded-full',
									stage.reached
										? 'bg-[rgb(var(--desktop-accent-rgb))]'
										: 'bg-(--desktop-border-subtle)'
								)}
								aria-hidden
							/>
						</button>
						{index < stages.length - 1 ? (
							<span
								className="mt-5 text-lg text-(--desktop-text-dim)"
								aria-hidden
							>
								→
							</span>
						) : null}
					</div>
				))}
			</div>
		</div>
	);
}

function PoemmaCustomerPathNoWorkspace({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет карты</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					Сначала создайте основу бизнеса на главной — появится период и путь
					клиента.
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

export function PoemmaCustomerPathPage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaCustomerPathPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const canEdit = userRole === 'owner';

	const [isLoading, setIsLoading] = useState(true);
	const [hasOrg, setHasOrg] = useState(false);
	const [periodId, setPeriodId] = useState<string | null>(null);
	const [customerPath, setCustomerPath] = useState<PoemmaCustomerPath | null>(
		null
	);
	const [churn, setChurn] = useState<PoemmaChurnSnapshot | null>(null);
	const [initiatives, setInitiatives] = useState<PoemmaInitiative[]>([]);
	const [showChurnDetail, setShowChurnDetail] = useState(false);
	const [isEditingChurn, setIsEditingChurn] = useState(false);
	const [churnDraft, setChurnDraft] = useState('');
	const [isEditingPainNote, setIsEditingPainNote] = useState(false);
	const [painDraft, setPainDraft] = useState('');
	const [churnBranchMessage, setChurnBranchMessage] = useState<string | null>(
		null
	);
	const [saveError, setSaveError] = useState<string | null>(null);

	const painBetween = customerPath
		? poemmaCustomerPathPainLabel(customerPath.stages)
		: null;

	const reload = useCallback(async () => {
		setIsLoading(true);
		setSaveError(null);
		const org = await repository.getOrg();
		if (!org) {
			setHasOrg(false);
			setIsLoading(false);
			return;
		}

		const period = await repository.getCurrentPeriod();
		const [path, churnSnapshot, ideaList] = await Promise.all([
			repository.getCustomerPath(org.id),
			period ? repository.getChurnSnapshot(period.id) : Promise.resolve(null),
			period
				? repository.listInitiatives(period.id)
				: Promise.resolve([] as PoemmaInitiative[]),
		]);

		setHasOrg(true);
		setPeriodId(period?.id ?? null);
		setCustomerPath(path);
		setChurn(churnSnapshot);
		setChurnDraft(
			churnSnapshot?.churnPerMonth != null
				? String(churnSnapshot.churnPerMonth)
				: ''
		);
		setPainDraft(path.painNote ?? '');
		setInitiatives(ideaList);
		setIsLoading(false);
	}, [repository]);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function persistCustomerPath(next: PoemmaCustomerPath): Promise<void> {
		try {
			await repository.saveCustomerPath(next);
			setCustomerPath(next);
			setSaveError(null);
		} catch (error) {
			setSaveError(
				error instanceof Error ? error.message : 'Не удалось сохранить путь'
			);
		}
	}

	function handleToggleReached(stageId: string): void {
		if (!canEdit || !customerPath) {
			return;
		}
		const nextStages = customerPath.stages.map((stage) =>
			stage.id === stageId ? { ...stage, reached: !stage.reached } : stage
		);
		void persistCustomerPath({ ...customerPath, stages: nextStages });
	}

	async function handleSavePainNote(): Promise<void> {
		if (!canEdit || !customerPath) {
			return;
		}
		await persistCustomerPath({
			...customerPath,
			painNote: painDraft.trim() || undefined,
		});
		setIsEditingPainNote(false);
	}

	async function handleSaveChurn(): Promise<void> {
		if (!canEdit || !periodId) {
			return;
		}
		const value = parsePoemmaChurnInput(churnDraft);
		if (value == null) {
			setSaveError('Введите число оттока за месяц');
			return;
		}
		const snapshot: PoemmaChurnSnapshot = {
			periodId,
			churnPerMonth: value,
			source: 'manual',
			updatedAt: new Date().toISOString(),
		};
		try {
			await repository.saveChurnSnapshot(snapshot);
			setChurn(snapshot);
			setIsEditingChurn(false);
			setSaveError(null);
		} catch (error) {
			setSaveError(
				error instanceof Error ? error.message : 'Не удалось сохранить отток'
			);
		}
	}

	function handleChurnBranch(answer: 'yes' | 'no'): void {
		if (answer === 'yes') {
			setChurnBranchMessage('Создайте идею удержания — кнопка «+ Идея» ниже.');
			onNavigate('/ideas');
			return;
		}
		setChurnBranchMessage('Закрепите: что работает у постоянных клиентов.');
	}

	if (isLoading) {
		return (
			<PoemmaPageLoading
				title="Загружаем путь клиента"
				description="Подтягиваем этапы, отток и идеи удержания."
			/>
		);
	}

	if (!hasOrg) {
		return <PoemmaCustomerPathNoWorkspace onNavigate={onNavigate} />;
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			<PoemmaPageHeader
				eyebrow={POEMMA_SECTION_EYEBROW.customerPath}
				title="Путь клиента"
				description="Новый → постоянный. Отметьте пройденные этапы и зафиксируйте точки боли."
			/>

			{saveError ? (
				<DesktopProductStatusBanner
					tone="warning"
					title="Проверьте данные"
					description={saveError}
				/>
			) : null}

			{customerPath ? (
				<PoemmaPagePanel className="grid gap-4">
					<PoemmaPageSection label="Этапы" spacing="none">
						<PoemmaCustomerPathStageChain
							stages={customerPath.stages}
							canEdit={canEdit}
							onToggleReached={handleToggleReached}
						/>
					</PoemmaPageSection>
					{painBetween ? (
						<div className="grid gap-3 border-t border-(--desktop-border-subtle) pt-4">
							<p className="text-sm text-(--desktop-text-secondary)">
								<span className="font-semibold text-(--desktop-text-primary)">
									Точка боли:
								</span>{' '}
								{painBetween}
							</p>
							{customerPath.painNote && !isEditingPainNote ? (
								<p className="rounded-(--desktop-radius-lg) bg-(--desktop-surface-soft) px-3 py-2 text-sm leading-relaxed text-(--desktop-text-primary)">
									{customerPath.painNote}
								</p>
							) : null}
							{isEditingPainNote ? (
								<div className="grid gap-2">
									<textarea
										className={POEMMA_TEXTAREA_CLASS}
										rows={3}
										value={painDraft}
										onChange={(event) => setPainDraft(event.target.value)}
										placeholder="Что мешает повторной покупке?"
									/>
									<div className="flex flex-wrap gap-2">
										<DesktopAppButton
											type="button"
											variant="accent"
											size="sm"
											onClick={() => void handleSavePainNote()}
										>
											Сохранить
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => {
												setPainDraft(customerPath.painNote ?? '');
												setIsEditingPainNote(false);
											}}
										>
											Отмена
										</DesktopAppButton>
									</div>
								</div>
							) : canEdit ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									className="self-start"
									onClick={() => setIsEditingPainNote(true)}
								>
									+ Заметка
								</DesktopAppButton>
							) : null}
						</div>
					) : null}
				</PoemmaPagePanel>
			) : null}

			<PoemmaPagePanel className="grid gap-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<PoemmaSectionTitle>Отток</PoemmaSectionTitle>
					{hasPoemmaChurnValue(churn) ? (
						<PoemmaEyebrowLabel tone="muted">
							{churn?.source === '1c' ? 'из 1С' : 'вручную'}
						</PoemmaEyebrowLabel>
					) : null}
				</div>

				{hasPoemmaChurnValue(churn) && !isEditingChurn ? (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-2xl font-semibold tracking-tight text-(--desktop-text-primary)">
							{churn?.churnPerMonth} / мес
						</p>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setShowChurnDetail((value) => !value)}
						>
							{showChurnDetail ? 'Свернуть' : 'Подробнее →'}
						</DesktopAppButton>
					</div>
				) : canEdit && isEditingChurn ? (
					<div className="grid gap-3">
						<PoemmaFormField label="Клиентов в месяц">
							<DesktopAppInput
								inputMode="numeric"
								aria-label="Клиентов в месяц"
								value={churnDraft}
								onChange={(event) => setChurnDraft(event.target.value)}
								placeholder="12"
							/>
						</PoemmaFormField>
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={() => void handleSaveChurn()}
							>
								Сохранить
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => {
									setChurnDraft(
										churn?.churnPerMonth != null
											? String(churn.churnPerMonth)
											: ''
									);
									setIsEditingChurn(false);
								}}
							>
								Отмена
							</DesktopAppButton>
						</div>
					</div>
				) : (
					<DesktopAppEmptyState
						title="Нет оттока"
						description="Введите цифру вручную или подключите 1С позже."
					>
						{canEdit ? (
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={() => setIsEditingChurn(true)}
							>
								Ввести
							</DesktopAppButton>
						) : null}
					</DesktopAppEmptyState>
				)}

				{canEdit && hasPoemmaChurnValue(churn) && !isEditingChurn ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="self-start"
						onClick={() => {
							setChurnDraft(String(churn?.churnPerMonth ?? ''));
							setIsEditingChurn(true);
						}}
					>
						Изменить
					</DesktopAppButton>
				) : null}

				{showChurnDetail && hasPoemmaChurnValue(churn) ? (
					<div className="grid gap-3 border-t border-(--desktop-border-subtle) pt-4">
						<p className="text-sm font-semibold text-(--desktop-text-primary)">
							Отток вырос?
						</p>
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								onClick={() => handleChurnBranch('yes')}
							>
								Да
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => handleChurnBranch('no')}
							>
								Нет
							</DesktopAppButton>
						</div>
						{churnBranchMessage ? (
							<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
								{churnBranchMessage}
							</p>
						) : null}
					</div>
				) : null}
			</PoemmaPagePanel>

			<PoemmaPagePanel className="grid gap-4">
				<PoemmaPageSection
					label="Идеи удержания"
					spacing="none"
					action={
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							onClick={() => onNavigate('/ideas')}
						>
							+ Идея
						</DesktopAppButton>
					}
				>
					{initiatives.length === 0 ? (
						<DesktopAppEmptyState
							title="Нет идей"
							description="Зафиксируйте гипотезу удержания — она появится в списке идей."
						>
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={() => onNavigate('/ideas')}
							>
								+ Идея
							</DesktopAppButton>
						</DesktopAppEmptyState>
					) : (
						<ul className="grid gap-2">
							{initiatives.map((idea) => (
								<li key={idea.id}>
									<PoemmaListRow className="flex flex-wrap items-center justify-between gap-2">
										<span className="font-medium text-(--desktop-text-primary)">
											{poemmaShortListTitle(idea.title)}
										</span>
										<span className="text-sm text-(--desktop-text-muted)">
											{poemmaInitiativeStatusLabel(idea.status)}
											{idea.source ? ` · ${idea.source}` : ''}
										</span>
									</PoemmaListRow>
								</li>
							))}
						</ul>
					)}
				</PoemmaPageSection>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
