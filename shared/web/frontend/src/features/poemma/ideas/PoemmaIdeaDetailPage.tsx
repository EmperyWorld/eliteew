/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Initiative detail `/ideas/:id` — story, source, verdict go/iterate/stop with mandatory note.
 *
 * Invariants:
 * - Verdict only for owner; repository enforces verdictNote when verdict is set.
 * - Data via getPoemmaRepository only.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §10
 * - poemma/docs/implementation/COPY-RU.md (verdict.*)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopAppButton,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type {
	PoemmaCustomerSegment,
	PoemmaInitiative,
	PoemmaUserRole,
	PoemmaVerdict,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaFieldError,
	PoemmaFormField,
	PoemmaMetricBadge,
	PoemmaPageBackNav,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaPageShell,
	POEMMA_TEXTAREA_CLASS,
} from '../ui';
import {
	buildPoemmaInitiativeForTesting,
	buildPoemmaInitiativeWithVerdict,
	canPoemmaRoleManageIdeas,
	canPoemmaRoleSetIdeaVerdict,
	formatPoemmaInitiativeListStatusLine,
	POEMMA_INITIATIVE_STATUS_LABELS,
	POEMMA_VERDICT_LABELS,
	validatePoemmaVerdictDraft,
} from './poemmaIdeasForm';

export type PoemmaIdeaDetailPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
	ideaId: string;
	decisionHint?: PoemmaVerdict;
};

function resolvePoemmaSegmentName(
	segments: PoemmaCustomerSegment[],
	segmentId?: string
): string | null {
	if (!segmentId) {
		return null;
	}
	return segments.find((segment) => segment.id === segmentId)?.name ?? null;
}

function resolvePoemmaDecisionHintNote(hint: PoemmaVerdict): string {
	switch (hint) {
		case 'go':
			return 'Продолжаем проверку и масштабируем рабочие шаги.';
		case 'iterate':
			return 'Нужна доработка гипотезы перед следующим циклом.';
		case 'stop':
			return 'Останавливаем и фиксируем выводы для команды.';
		default:
			return '';
	}
}

export function PoemmaIdeaDetailPage({
	ownerUserId,
	userRole,
	onNavigate,
	ideaId,
	decisionHint,
}: PoemmaIdeaDetailPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [initiative, setInitiative] = useState<PoemmaInitiative | null>(null);
	const [segments, setSegments] = useState<PoemmaCustomerSegment[]>([]);
	const [selectedVerdict, setSelectedVerdict] = useState<PoemmaVerdict | null>(
		null
	);
	const [verdictNote, setVerdictNote] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const canManage = canPoemmaRoleManageIdeas(userRole);
	const canSetVerdict = canPoemmaRoleSetIdeaVerdict(userRole);

	const loadInitiative = useCallback(async () => {
		const period = await repository.getCurrentPeriod();
		if (!period) {
			setInitiative(null);
			setSegments([]);
			setIsLoaded(true);
			return;
		}

		const organization = await repository.getOrg();
		const [items, segmentList] = await Promise.all([
			repository.listInitiatives(period.id),
			organization
				? repository.listSegments(organization.id)
				: Promise.resolve([] as PoemmaCustomerSegment[]),
		]);

		const found = items.find((item) => item.id === ideaId) ?? null;
		setInitiative(found);
		setSegments(segmentList);
		if (found?.verdict) {
			setSelectedVerdict(found.verdict);
			setVerdictNote(found.verdictNote ?? '');
			setSaveMessage(null);
		} else if (decisionHint) {
			setSelectedVerdict(decisionHint);
			setVerdictNote(resolvePoemmaDecisionHintNote(decisionHint));
			setSaveMessage('Решение предзаполнено из блока «Что делать»');
		} else {
			setSelectedVerdict(null);
			setVerdictNote('');
			setSaveMessage(null);
		}
		setIsLoaded(true);
	}, [repository, ideaId, decisionHint]);

	useEffect(() => {
		if (!canManage) {
			setIsLoaded(true);
			return;
		}

		let isMounted = true;
		setIsLoaded(false);

		void loadInitiative().then(() => {
			if (!isMounted) {
				return;
			}
		});

		return () => {
			isMounted = false;
		};
	}, [canManage, loadInitiative]);

	if (!canManage) {
		return (
			<div className="p-4">
				<DesktopProductStatusBanner
					tone="warning"
					title="Нет доступа"
					description="Идеи доступны собственнику и команде."
				/>
			</div>
		);
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем карточку идеи"
				description="Подтягиваем историю идеи и связанный контекст."
			/>
		);
	}

	if (!initiative) {
		return (
			<PoemmaPageShell>
				<PoemmaPageBackNav
					label="← Идеи"
					onNavigate={() => onNavigate('/ideas')}
				/>
				<DesktopProductStatusBanner
					tone="warning"
					title="Идея не найдена"
					description="Вернитесь к списку и выберите другую карточку."
				/>
			</PoemmaPageShell>
		);
	}

	const currentInitiative = initiative;
	const segmentName = resolvePoemmaSegmentName(
		segments,
		currentInitiative.segmentId
	);
	const isDecided = currentInitiative.status === 'decided';

	async function persistInitiative(next: PoemmaInitiative): Promise<void> {
		setIsSaving(true);
		setSaveMessage(null);
		try {
			await repository.saveInitiative(next);
			setInitiative(next);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleStartTesting(): Promise<void> {
		const next = buildPoemmaInitiativeForTesting(currentInitiative);
		await persistInitiative(next);
		setSaveMessage('Идея в проверке');
	}

	async function handleSaveVerdict(): Promise<void> {
		const error = validatePoemmaVerdictDraft({
			verdict: selectedVerdict,
			verdictNote,
		});
		if (error) {
			setValidationError(error);
			return;
		}

		setValidationError(null);
		if (!selectedVerdict) {
			setValidationError('Выберите решение');
			return;
		}
		const next = buildPoemmaInitiativeWithVerdict(
			currentInitiative,
			selectedVerdict,
			verdictNote
		);
		await persistInitiative(next);
		setSaveMessage('Решение сохранено');
	}

	return (
		<PoemmaPageShell>
			<PoemmaPageBackNav
				label="← Идеи"
				onNavigate={() => onNavigate('/ideas')}
			/>

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.ideaDetail}
					title={initiative.title}
					description={`${formatPoemmaInitiativeListStatusLine(initiative)} · ${POEMMA_INITIATIVE_STATUS_LABELS[initiative.status]}`}
					meta={
						<PoemmaMetricBadge
							label={POEMMA_INITIATIVE_STATUS_LABELS[initiative.status]}
							tone={isDecided ? 'accent' : 'neutral'}
						/>
					}
				/>

				<PoemmaPageSection label="История" spacing="compact">
					<p className="whitespace-pre-wrap text-base leading-7 text-(--desktop-text-primary)">
						{initiative.story}
					</p>
				</PoemmaPageSection>

				{initiative.source ? (
					<PoemmaPageSection label="Источник" spacing="compact">
						<p className="text-base text-(--desktop-text-primary)">
							{initiative.source}
						</p>
					</PoemmaPageSection>
				) : null}

				{segmentName ? (
					<PoemmaPageSection label="Сегмент" spacing="compact">
						<p className="text-base text-(--desktop-text-primary)">
							{segmentName}
						</p>
					</PoemmaPageSection>
				) : null}

				<PoemmaPageSection label="Акция" spacing="compact">
					<p className="text-base text-(--desktop-text-secondary)">—</p>
				</PoemmaPageSection>

				{!isDecided && initiative.status === 'backlog' ? (
					<PoemmaActionRow
						actions={
							<DesktopAppButton
								type="button"
								variant="neutral"
								disabled={isSaving}
								onClick={() => void handleStartTesting()}
							>
								В проверку
							</DesktopAppButton>
						}
						hint="Переведите идею в проверку, когда готовы тестировать гипотезу."
					/>
				) : null}

				<PoemmaPageSection label="Решение" variant="framed">
					{!canSetVerdict ? (
						<DesktopProductStatusBanner
							tone="info"
							title="Вердикт — собственник"
							description="Команда может предложить решение в задаче или на встрече."
						/>
					) : null}
					<PoemmaActionRow
						actions={(
							Object.keys(POEMMA_VERDICT_LABELS) as PoemmaVerdict[]
						).map((verdict) => (
							<DesktopAppButton
								key={verdict}
								type="button"
								variant={selectedVerdict === verdict ? 'accent' : 'neutral'}
								disabled={!canSetVerdict || isDecided || isSaving}
								onClick={() => {
									setSelectedVerdict(verdict);
									setValidationError(null);
									setSaveMessage(null);
								}}
							>
								{POEMMA_VERDICT_LABELS[verdict]}
							</DesktopAppButton>
						))}
					/>
					<PoemmaFormField label="Комментарий к решению (обязателен)">
						<textarea
							className={cn(POEMMA_TEXTAREA_CLASS, 'min-h-24')}
							aria-label="Комментарий к решению"
							value={verdictNote}
							disabled={!canSetVerdict || isDecided}
							onChange={(event) => {
								setVerdictNote(event.target.value);
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
					{canSetVerdict && !isDecided ? (
						<PoemmaActionRow
							actions={
								<DesktopAppButton
									type="button"
									variant="accent"
									disabled={isSaving}
									onClick={() => void handleSaveVerdict()}
								>
									{isSaving ? 'Сохраняем…' : 'Сохранить решение'}
								</DesktopAppButton>
							}
						/>
					) : null}
					{isDecided && initiative.verdictNote ? (
						<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
							{initiative.verdictNote}
						</p>
					) : null}
				</PoemmaPageSection>

				<PoemmaActionRow
					className="mt-6"
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => onNavigate('/team')}
						>
							+ Задача команде
						</DesktopAppButton>
					}
					hint="Свяжите решение с задачей команды."
				/>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
