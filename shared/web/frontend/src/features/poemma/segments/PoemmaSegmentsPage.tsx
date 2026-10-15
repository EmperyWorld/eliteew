/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only /segments screen: four customer segments, share %, notes, sum warning.
 *
 * Invariants:
 * - Exactly four segment slots (wireframes §5).
 * - Data access only via getPoemmaRepository.
 * - Team roles see access notice, not segment editing.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §5
 * - poemma/docs/architecture/marketing-cabinet-backlog.md P-605
 * - src/features/poemma/ui/ (wave-4 page shell)
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { DEFAULT_POEMMA_ONBOARDING_SEGMENTS } from '../onboarding/poemmaOnboardingSteps';
import type { PoemmaUserRole } from '../poemmaDomain';
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
	POEMMA_SECTION_CARD_CLASS,
	POEMMA_TEXTAREA_CLASS,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaSegmentsForSave,
	createEmptyPoemmaSegmentDrafts,
	parsePoemmaSegmentShareInput,
	poemmaSegmentDraftsFromStored,
	poemmaSegmentShareTotalFromDrafts,
	validatePoemmaSegmentsDraft,
	type PoemmaSegmentDraft,
} from './poemmaSegmentsForm';

export interface PoemmaSegmentsPageProps {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
}

function PoemmaSegmentsAccessDenied() {
	return (
		<PoemmaAccessDenied description="Команда видит только задачи, опыт и нужные ветки. Сегменты и доли доступны собственнику." />
	);
}

function PoemmaSegmentsNoOrg({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет бизнеса</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					Сначала создайте основу на карте — появится организация и сегменты.
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

function SegmentShareWarning({ total }: { total: number }) {
	if (total === 100) {
		return (
			<p className="text-sm font-semibold text-(--desktop-text-muted)">
				Сумма 100%
			</p>
		);
	}

	return (
		<DesktopProductStatusBanner
			tone="warning"
			title={`Сумма ${total}%`}
			description="Доли сегментов должны в сумме давать 100%."
		/>
	);
}

export function PoemmaSegmentsPage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaSegmentsPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [orgId, setOrgId] = useState<string | null>(null);
	const [drafts, setDrafts] = useState<PoemmaSegmentDraft[]>(
		createEmptyPoemmaSegmentDrafts
	);
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

		async function loadSegmentsPage(): Promise<void> {
			const org = await repository.getOrg();
			if (!isMounted) {
				return;
			}
			if (!org) {
				setOrgId(null);
				setDrafts(createEmptyPoemmaSegmentDrafts());
				setIsLoaded(true);
				return;
			}

			const segments = await repository.listSegments(org.id);
			if (!isMounted) {
				return;
			}

			setOrgId(org.id);
			setDrafts(poemmaSegmentDraftsFromStored(segments));
			setIsLoaded(true);
		}

		setIsLoaded(false);
		void loadSegmentsPage();

		return () => {
			isMounted = false;
		};
	}, [repository, userRole]);

	const shareTotal = useMemo(
		() => poemmaSegmentShareTotalFromDrafts(drafts),
		[drafts]
	);

	if (userRole !== 'owner') {
		return <PoemmaSegmentsAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем сегменты"
				description="Подтягиваем текущую структуру аудитории и доли."
			/>
		);
	}

	if (!orgId) {
		return <PoemmaSegmentsNoOrg onNavigate={onNavigate} />;
	}

	function updateDraft(
		index: number,
		patch: Partial<Pick<PoemmaSegmentDraft, 'name' | 'sharePercent' | 'note'>>
	): void {
		setDrafts((current) =>
			current.map((draft, draftIndex) =>
				draftIndex === index ? { ...draft, ...patch } : draft
			)
		);
		setValidationError(null);
		setSaveMessage(null);
	}

	function resetSharesToDefaults(): void {
		setDrafts((current) =>
			current.map((draft, index) => ({
				...draft,
				sharePercent:
					DEFAULT_POEMMA_ONBOARDING_SEGMENTS[index]?.sharePercent ??
					draft.sharePercent,
			}))
		);
		setSaveMessage(null);
	}

	async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setSaveMessage(null);

		const validation = validatePoemmaSegmentsDraft(drafts);
		if (validation) {
			setValidationError(validation);
			return;
		}

		setValidationError(null);
		setIsSaving(true);
		try {
			if (!orgId) {
				setValidationError('Нет организации для сохранения сегментов');
				return;
			}
			const currentOrgId = orgId;
			const segments = buildPoemmaSegmentsForSave(currentOrgId, drafts);
			await repository.saveSegments(currentOrgId, segments);
			setDrafts(poemmaSegmentDraftsFromStored(segments));
			setSaveMessage('Сегменты сохранены');
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.segments}
					title="Кто покупает"
					description={POEMMA_PAGE_DESCRIPTION.segments}
				/>

				<form onSubmit={handleSave}>
					<PoemmaPageSection spacing="compact">
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							{drafts.map((segment, index) => (
								<section
									key={segment.id ?? `segment-card-${index}`}
									className={POEMMA_SECTION_CARD_CLASS}
								>
									<PoemmaFormField label="Сегмент" labelStyle="eyebrow">
										<DesktopAppInput
											aria-label={`Сегмент ${index + 1}`}
											value={segment.name}
											onChange={(event) =>
												updateDraft(index, { name: event.target.value })
											}
										/>
									</PoemmaFormField>

									<PoemmaFormField label="Доля %" labelStyle="eyebrow">
										<DesktopAppInput
											type="number"
											min={0}
											max={100}
											inputMode="numeric"
											aria-label={`Доля сегмента ${index + 1}`}
											value={segment.sharePercent}
											onChange={(event) =>
												updateDraft(index, {
													sharePercent: parsePoemmaSegmentShareInput(
														event.target.value
													),
												})
											}
										/>
										<p className="text-2xl font-semibold tracking-tight text-(--desktop-text-primary)">
											{segment.sharePercent}%
										</p>
									</PoemmaFormField>

									<PoemmaFormField label="Заметка" labelStyle="eyebrow">
										<textarea
											className={cn(POEMMA_TEXTAREA_CLASS, 'min-h-18')}
											rows={3}
											placeholder="Коротко о сегменте"
											aria-label={`Заметка сегмента ${index + 1}`}
											value={segment.note}
											onChange={(event) =>
												updateDraft(index, { note: event.target.value })
											}
										/>
									</PoemmaFormField>
								</section>
							))}
						</div>
					</PoemmaPageSection>

					<PoemmaPageSection spacing="compact">
						<SegmentShareWarning total={shareTotal} />
					</PoemmaPageSection>

					<PoemmaPageSection spacing="compact">
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
										{isSaving ? 'Сохраняем…' : 'Сохранить'}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="neutral"
										onClick={resetSharesToDefaults}
										disabled={isSaving}
									>
										Сбросить доли
									</DesktopAppButton>
								</>
							}
						/>
					</PoemmaPageSection>
				</form>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
