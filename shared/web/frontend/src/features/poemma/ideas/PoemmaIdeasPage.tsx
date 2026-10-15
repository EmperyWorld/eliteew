/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ideas list `/ideas` with filters and optional embedded detail when `ideaId` is set.
 *
 * Invariants:
 * - List title ≤5 words; status backlog / testing / decided.
 * - Repository-only persistence via listInitiatives / saveInitiative.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §9
 * - marketing-cabinet-backlog.md P-401, P-402
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
	DesktopAppListRow,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type {
	PoemmaInitiative,
	PoemmaPeriod,
	PoemmaUserRole,
	PoemmaVerdict,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaFieldError,
	PoemmaFilterTabs,
	PoemmaFormField,
	PoemmaPageBackNav,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaAccessDenied,
	PoemmaPageShell,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import { PoemmaIdeaDetailPage } from './PoemmaIdeaDetailPage';
import {
	canPoemmaRoleManageIdeas,
	createPoemmaInitiativeDraft,
	filterPoemmaInitiativesByTab,
	formatPoemmaInitiativeListStatusLine,
	sortPoemmaInitiativesForList,
	truncatePoemmaIdeaListTitle,
	validatePoemmaIdeaDraft,
	type PoemmaIdeasFilterTab,
} from './poemmaIdeasForm';

const FILTER_TABS: { key: PoemmaIdeasFilterTab; label: string }[] = [
	{ key: 'all', label: 'Все' },
	{ key: 'testing', label: 'Проверяем' },
	{ key: 'decided', label: 'Решено' },
];

export type PoemmaIdeasPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
	ideaId?: string;
	decisionHint?: PoemmaVerdict;
};

function PoemmaIdeasAccessDenied() {
	return (
		<PoemmaAccessDenied
			title="Нет доступа"
			description="Идеи доступны собственнику и команде."
		/>
	);
}

function PoemmaIdeasNoPeriod({
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

export function PoemmaIdeasPage({
	ownerUserId,
	userRole,
	onNavigate,
	ideaId,
	decisionHint,
}: PoemmaIdeasPageProps) {
	if (ideaId?.trim()) {
		return (
			<PoemmaIdeaDetailPage
				ownerUserId={ownerUserId}
				userRole={userRole}
				onNavigate={onNavigate}
				ideaId={ideaId.trim()}
				decisionHint={decisionHint}
			/>
		);
	}

	return (
		<PoemmaIdeasListView
			ownerUserId={ownerUserId}
			userRole={userRole}
			onNavigate={onNavigate}
		/>
	);
}

function PoemmaIdeasListView({
	ownerUserId,
	userRole,
	onNavigate,
}: Omit<PoemmaIdeasPageProps, 'ideaId'>) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [period, setPeriod] = useState<PoemmaPeriod | null>(null);
	const [initiatives, setInitiatives] = useState<PoemmaInitiative[]>([]);
	const [activeTab, setActiveTab] = useState<PoemmaIdeasFilterTab>('all');
	const [isLoaded, setIsLoaded] = useState(false);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [titleInput, setTitleInput] = useState('');
	const [storyInput, setStoryInput] = useState('');
	const [sourceInput, setSourceInput] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const canManage = canPoemmaRoleManageIdeas(userRole);

	const reloadInitiatives = useCallback(
		async (periodId: string) => {
			const items = await repository.listInitiatives(periodId);
			setInitiatives(items);
		},
		[repository]
	);

	useEffect(() => {
		if (!canManage) {
			setIsLoaded(true);
			return;
		}

		let isMounted = true;
		setIsLoaded(false);

		async function loadIdeasList(): Promise<void> {
			const currentPeriod = await repository.getCurrentPeriod();
			if (!isMounted) {
				return;
			}
			if (!currentPeriod) {
				setPeriod(null);
				setInitiatives([]);
				setIsLoaded(true);
				return;
			}

			setPeriod(currentPeriod);
			await reloadInitiatives(currentPeriod.id);
			if (isMounted) {
				setIsLoaded(true);
			}
		}

		void loadIdeasList();

		return () => {
			isMounted = false;
		};
	}, [canManage, repository, reloadInitiatives]);

	if (!canManage) {
		return <PoemmaIdeasAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем идеи"
				description="Получаем список гипотез и их текущие статусы."
			/>
		);
	}

	if (!period) {
		return <PoemmaIdeasNoPeriod onNavigate={onNavigate} />;
	}

	const currentPeriod = period;

	const filtered = sortPoemmaInitiativesForList(
		filterPoemmaInitiativesByTab(initiatives, activeTab)
	);

	async function handleCreateIdea(
		event: FormEvent<HTMLFormElement>
	): Promise<void> {
		event.preventDefault();
		const error = validatePoemmaIdeaDraft({
			title: titleInput,
			story: storyInput,
		});
		if (error) {
			setValidationError(error);
			return;
		}

		setValidationError(null);
		setIsSaving(true);
		try {
			const draft = createPoemmaInitiativeDraft({
				periodId: currentPeriod.id,
				title: titleInput,
				story: storyInput,
				source: sourceInput,
			});
			await repository.saveInitiative(draft);
			setTitleInput('');
			setStoryInput('');
			setSourceInput('');
			setShowCreateForm(false);
			await reloadInitiatives(currentPeriod.id);
			onNavigate(`/ideas/${draft.id}`);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<PoemmaPageShell>
			<PoemmaPageBackNav label="← Карта" onNavigate={() => onNavigate('/')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.ideas}
					title="Идеи"
					description="Гипотезы, проверки и решения за 90 дней. Короткие названия — до пяти слов."
					actions={
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							onClick={() => {
								setShowCreateForm((value) => !value);
								setValidationError(null);
							}}
						>
							+ Идея
						</DesktopAppButton>
					}
				/>

				<PoemmaPageSection spacing="compact">
					<PoemmaFilterTabs
						tabs={FILTER_TABS}
						activeKey={activeTab}
						onChange={setActiveTab}
					/>
				</PoemmaPageSection>

				{showCreateForm ? (
					<PoemmaPageSection spacing="compact">
						<form className="grid gap-3" onSubmit={handleCreateIdea}>
							<PoemmaFormField label="Название">
								<DesktopAppInput
									type="text"
									aria-label="Название идеи"
									value={titleInput}
									onChange={(event) => setTitleInput(event.target.value)}
								/>
							</PoemmaFormField>
							<PoemmaFormField label="История">
								<textarea
									className={cn(POEMMA_TEXTAREA_CLASS, 'min-h-28')}
									aria-label="История идеи"
									value={storyInput}
									onChange={(event) => setStoryInput(event.target.value)}
								/>
							</PoemmaFormField>
							<PoemmaFormField label="Источник">
								<DesktopAppInput
									type="text"
									aria-label="Источник идеи"
									value={sourceInput}
									onChange={(event) => setSourceInput(event.target.value)}
								/>
							</PoemmaFormField>
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
											variant="ghost"
											onClick={() => setShowCreateForm(false)}
										>
											Отмена
										</DesktopAppButton>
									</>
								}
							/>
						</form>
					</PoemmaPageSection>
				) : null}

				<PoemmaPageSection label="Список" spacing="compact">
					{initiatives.length === 0 ? (
						<DesktopAppEmptyState
							title="Нет идей"
							description="Запишите гипотезу, пока она в голове."
						>
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={() => setShowCreateForm(true)}
							>
								+ Идея
							</DesktopAppButton>
						</DesktopAppEmptyState>
					) : filtered.length === 0 ? (
						<p className="text-sm text-(--desktop-text-secondary)">
							В этой вкладке пока пусто.
						</p>
					) : (
						<ul className="grid gap-2">
							{filtered.map((item) => (
								<li key={item.id}>
									<DesktopAppListRow
										type="button"
										className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
										onClick={() => onNavigate(`/ideas/${item.id}`)}
									>
										<span className="min-w-0 flex-1 font-semibold text-(--desktop-text-primary)">
											{truncatePoemmaIdeaListTitle(item.title)}
										</span>
										<span className="shrink-0 text-sm text-(--desktop-text-muted)">
											{formatPoemmaInitiativeListStatusLine(item)}
										</span>
										{item.source ? (
											<span className="hidden max-w-32 truncate text-sm text-(--desktop-text-secondary) sm:inline">
												{item.source}
											</span>
										) : null}
									</DesktopAppListRow>
								</li>
							))}
						</ul>
					)}
				</PoemmaPageSection>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
