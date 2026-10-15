/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Team tasks screen (P-502): tabs Мои / Ждут Зою / Готово, task form, owner vs team ACL.
 *
 * Invariants:
 * - Owner sees and edits all tasks; team sees only assigned tasks.
 * - Data access only via getPoemmaRepository (no direct localStorage).
 * - List titles ≤5 words; form fields per wireframes §14.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §14
 * - src/features/poemma/team/poemmaTeamModel.ts
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
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type {
	PoemmaOrganization,
	PoemmaTeamTask,
	PoemmaUserRole,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaFieldError,
	PoemmaFilterTabs,
	PoemmaFormField,
	PoemmaEyebrowLabel,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaPageShell,
	PoemmaSectionTitle,
} from '../ui';
import {
	canPoemmaMemberToggleTaskDone,
	canPoemmaRoleCreateTeamTasks,
	createEmptyPoemmaTeamTaskDraft,
	filterPoemmaTeamTasksByTab,
	formatPoemmaTeamTaskMetaLine,
	isPoemmaTeamOwner,
	POEMMA_TEAM_LINK_TYPE_LABELS,
	POEMMA_TEAM_MEMBERS,
	POEMMA_TEAM_STATUS_LABELS,
	POEMMA_TEAM_TAB_LABELS,
	resolvePoemmaTeamMemberId,
	sortPoemmaTeamTasksForList,
	togglePoemmaTeamTaskDone,
	truncatePoemmaTeamListTitle,
	validatePoemmaTeamTaskDraft,
	type PoemmaTeamTab,
	type PoemmaTeamTaskLinkType,
} from './poemmaTeamModel';

export interface PoemmaTeamPageProps {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
}

type TeamTaskDraft = Omit<PoemmaTeamTask, 'id'> & { id?: string };

const TEAM_FILTER_TABS = (
	['mine', 'waiting_owner', 'done'] as const satisfies readonly PoemmaTeamTab[]
).map((key) => ({
	key,
	label: POEMMA_TEAM_TAB_LABELS[key],
}));

function createPoemmaTaskId(): string {
	return `task-${globalThis.crypto.randomUUID()}`;
}

function PoemmaTeamNoOrg({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет бизнеса</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					Сначала создайте основу на карте — появятся задачи команды.
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

function PoemmaTeamTaskForm({
	draft,
	ownerDisplayName,
	validationError,
	isSaving,
	onChange,
	onSubmit,
	onClose,
}: {
	draft: TeamTaskDraft;
	ownerDisplayName: string;
	validationError: string | null;
	isSaving: boolean;
	onChange: (next: TeamTaskDraft) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onClose: () => void;
}) {
	const linkOptions = (
		Object.entries(POEMMA_TEAM_LINK_TYPE_LABELS) as [
			PoemmaTeamTaskLinkType,
			string,
		][]
	).map(([value, label]) => ({ value, label }));

	const statusOptions = (
		Object.entries(POEMMA_TEAM_STATUS_LABELS) as [
			PoemmaTeamTask['status'],
			string,
		][]
	).map(([value, label]) => ({ value, label }));

	return (
		<DesktopPortaledConfirmShell
			onDismiss={onClose}
			zIndex={{ backdrop: 1200, content: 1210 }}
			dismissAriaLabel="Закрыть форму задачи"
			contentClassName="flex items-start justify-center p-4"
		>
			<DesktopAppModalFrame
				title={draft.id ? 'Задача' : 'Новая задача'}
				onClose={onClose}
				className="w-full max-w-lg"
			>
				<form className="grid gap-4 p-4" onSubmit={onSubmit}>
					<PoemmaFormField label="Название">
						<DesktopAppInput
							type="text"
							aria-label="Название задачи"
							value={draft.title}
							onChange={(event) =>
								onChange({ ...draft, title: event.target.value })
							}
						/>
					</PoemmaFormField>

					<div className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Кому
						</span>
						<DesktopNativeSelect
							aria-label="Исполнитель"
							value={draft.assigneeId ?? ''}
							onChange={(event) =>
								onChange({
									...draft,
									assigneeId: event.target.value || undefined,
								})
							}
						>
							{POEMMA_TEAM_MEMBERS.map((member) => (
								<option key={member.id} value={member.id}>
									{member.id === 'member-zoya'
										? ownerDisplayName || member.displayName
										: member.displayName}
								</option>
							))}
						</DesktopNativeSelect>
					</div>

					<PoemmaFormField label="До">
						<DesktopAppInput
							type="date"
							aria-label="Срок задачи"
							value={draft.dueDate ?? ''}
							onChange={(event) =>
								onChange({
									...draft,
									dueDate: event.target.value || undefined,
								})
							}
						/>
					</PoemmaFormField>

					<div className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Связь
						</span>
						<DesktopNativeSelect
							aria-label="Связь задачи"
							value={draft.linkType ?? 'none'}
							onChange={(event) =>
								onChange({
									...draft,
									linkType: event.target.value as PoemmaTeamTaskLinkType,
								})
							}
						>
							{linkOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</DesktopNativeSelect>
					</div>

					<div className="grid gap-1">
						<span className="text-sm font-semibold text-(--desktop-text-secondary)">
							Статус
						</span>
						<DesktopNativeSelect
							aria-label="Статус задачи"
							value={draft.status}
							onChange={(event) =>
								onChange({
									...draft,
									status: event.target.value as PoemmaTeamTask['status'],
								})
							}
						>
							{statusOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</DesktopNativeSelect>
					</div>

					<PoemmaFieldError message={validationError} />

					<PoemmaActionRow
						actions={
							<>
								<DesktopAppButton
									type="submit"
									variant="accent"
									disabled={isSaving}
								>
									{isSaving ? 'Сохраняем…' : 'Сохранить'}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={onClose}
								>
									Отмена
								</DesktopAppButton>
							</>
						}
					/>
				</form>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	);
}

export function PoemmaTeamPage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaTeamPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const memberId = resolvePoemmaTeamMemberId(userRole);
	const canCreate = canPoemmaRoleCreateTeamTasks(userRole);

	const [org, setOrg] = useState<PoemmaOrganization | null>(null);
	const [tasks, setTasks] = useState<PoemmaTeamTask[]>([]);
	const [activeTab, setActiveTab] = useState<PoemmaTeamTab>('mine');
	const [isLoaded, setIsLoaded] = useState(false);
	const [formOpen, setFormOpen] = useState(false);
	const [draft, setDraft] = useState<TeamTaskDraft | null>(null);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const reloadTasks = useCallback(
		async (orgId: string) => {
			const nextTasks = await repository.listTeamTasks(orgId);
			setTasks(nextTasks);
		},
		[repository]
	);

	useEffect(() => {
		let isMounted = true;

		async function loadTeamPage(): Promise<void> {
			const loadedOrg = await repository.getOrg();
			if (!isMounted) {
				return;
			}
			if (!loadedOrg) {
				setOrg(null);
				setTasks([]);
				setIsLoaded(true);
				return;
			}

			setOrg(loadedOrg);
			await reloadTasks(loadedOrg.id);
			if (isMounted) {
				setIsLoaded(true);
			}
		}

		setIsLoaded(false);
		void loadTeamPage();

		return () => {
			isMounted = false;
		};
	}, [repository, reloadTasks]);

	const visibleTasks = useMemo(() => {
		return sortPoemmaTeamTasksForList(
			filterPoemmaTeamTasksByTab(tasks, activeTab, userRole, memberId)
		);
	}, [tasks, activeTab, userRole, memberId]);

	function openCreateForm(): void {
		if (!org) {
			return;
		}
		setValidationError(null);
		setDraft(createEmptyPoemmaTeamTaskDraft(org.id));
		setFormOpen(true);
	}

	function openEditForm(task: PoemmaTeamTask): void {
		setValidationError(null);
		setDraft({ ...task });
		setFormOpen(true);
	}

	function closeForm(): void {
		setFormOpen(false);
		setDraft(null);
		setValidationError(null);
	}

	async function handleSaveTask(
		event: FormEvent<HTMLFormElement>
	): Promise<void> {
		event.preventDefault();
		if (!org || !draft) {
			return;
		}

		const error = validatePoemmaTeamTaskDraft({ title: draft.title });
		if (error) {
			setValidationError(error);
			return;
		}

		setValidationError(null);
		setIsSaving(true);
		try {
			const task: PoemmaTeamTask = {
				id: draft.id ?? createPoemmaTaskId(),
				orgId: org.id,
				title: draft.title.trim(),
				assigneeId: draft.assigneeId,
				dueDate: draft.dueDate?.trim() || undefined,
				status: draft.status,
				linkType: draft.linkType ?? 'none',
				linkId: draft.linkId,
			};
			await repository.saveTeamTask(task);
			await reloadTasks(org.id);
			closeForm();
		} finally {
			setIsSaving(false);
		}
	}

	async function handleToggleDone(
		task: PoemmaTeamTask,
		checked: boolean
	): Promise<void> {
		if (!org || !canPoemmaMemberToggleTaskDone(task, userRole, memberId)) {
			return;
		}
		const nextTask = togglePoemmaTeamTaskDone(task, checked);
		await repository.saveTeamTask(nextTask);
		await reloadTasks(org.id);
		if (nextTask.status === 'done' && activeTab !== 'done') {
			setActiveTab('done');
		}
		if (!checked && activeTab === 'done') {
			setActiveTab('mine');
		}
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем задачи команды"
				description="Подтягиваем список задач и актуальные статусы."
			/>
		);
	}

	if (!org) {
		return <PoemmaTeamNoOrg onNavigate={onNavigate} />;
	}

	const ownerDisplayName = org.ownerDisplayName;

	return (
		<PoemmaPageShell>
			<PoemmaPageHeader
				eyebrow={POEMMA_SECTION_EYEBROW.team}
				title="Задачи команды"
				description={
					isPoemmaTeamOwner(userRole)
						? 'Расставьте приоритеты на неделю и следите, что ждёт вашего решения.'
						: 'Здесь только ваши задачи и их статусы.'
				}
				meta={
					isPoemmaTeamOwner(userRole)
						? `Всего задач: ${tasks.length}`
						: `Ваших задач: ${visibleTasks.length}`
				}
			/>

			<PoemmaPagePanel>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<PoemmaSectionTitle as="h2">Команда</PoemmaSectionTitle>
						{!isPoemmaTeamOwner(userRole) ? (
							<p className="mt-2 text-sm text-(--desktop-text-secondary)">
								Видны только ваши задачи.
							</p>
						) : null}
					</div>
					{canCreate ? (
						<DesktopAppButton
							type="button"
							variant="accent"
							onClick={openCreateForm}
						>
							+ Задача
						</DesktopAppButton>
					) : null}
				</div>

				<PoemmaPageSection spacing="compact">
					<PoemmaFilterTabs
						tabs={TEAM_FILTER_TABS}
						activeKey={activeTab}
						onChange={setActiveTab}
						roleMode="tab"
						tabListAriaLabel="Фильтр задач"
					/>
				</PoemmaPageSection>

				<PoemmaPageSection spacing="compact">
					{visibleTasks.length === 0 ? (
						<DesktopAppEmptyState
							title={
								isPoemmaTeamOwner(userRole)
									? 'Нет задач в этом списке'
									: 'Нет ваших задач'
							}
							description={
								canCreate
									? 'Добавьте задачу — меньше согласований в чатах.'
									: 'Когда собственник назначит задачу, она появится здесь.'
							}
						/>
					) : (
						<div className="grid gap-2">
							{visibleTasks.map((task) => {
								const canToggle = canPoemmaMemberToggleTaskDone(
									task,
									userRole,
									memberId
								);
								const canEdit = isPoemmaTeamOwner(userRole);
								const isDone = task.status === 'done';

								return (
									<div
										key={task.id}
										className={cn(
											'flex items-start gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) px-3 py-3',
											isDone && 'opacity-80'
										)}
									>
										<input
											type="checkbox"
											className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]"
											checked={isDone}
											disabled={!canToggle}
											aria-label={
												isDone
													? `Снять «${truncatePoemmaTeamListTitle(task.title)}»`
													: `Закрыть «${truncatePoemmaTeamListTitle(task.title)}»`
											}
											onChange={(event) =>
												void handleToggleDone(task, event.target.checked)
											}
										/>
										<button
											type="button"
											className={cn(
												'min-w-0 flex-1 text-left',
												canEdit && 'cursor-pointer hover:opacity-90'
											)}
											disabled={!canEdit}
											onClick={() => {
												if (canEdit) {
													openEditForm(task);
												}
											}}
										>
											<p
												className={cn(
													'text-base font-semibold text-(--desktop-text-primary)',
													isDone && 'line-through'
												)}
											>
												{truncatePoemmaTeamListTitle(task.title)}
											</p>
											<p className="mt-1 text-sm text-(--desktop-text-secondary)">
												{formatPoemmaTeamTaskMetaLine(task, ownerDisplayName)}
											</p>
										</button>
										{isDone ? (
											<PoemmaEyebrowLabel tone="muted" className="shrink-0">
												done
											</PoemmaEyebrowLabel>
										) : null}
									</div>
								);
							})}
						</div>
					)}
				</PoemmaPageSection>
			</PoemmaPagePanel>

			{formOpen && draft ? (
				<PoemmaTeamTaskForm
					draft={draft}
					ownerDisplayName={ownerDisplayName}
					validationError={validationError}
					isSaving={isSaving}
					onChange={setDraft}
					onSubmit={(event) => void handleSaveTask(event)}
					onClose={closeForm}
				/>
			) : null}
		</PoemmaPageShell>
	);
}
