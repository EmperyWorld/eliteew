/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only promo action card `/promo/actions/:id` for checklist execution, budget, and status transitions.
 *
 * Invariants:
 * - Promotion metadata and checklist persist only through getPoemmaRepository.
 * - Missing promotion keeps user inside promo flow with explicit fallback state.
 * - Checklist toggles are idempotent and tied to current promotion id.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §12
 * - src/features/poemma/promo/PoemmaPromoPage.tsx
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
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type {
	PoemmaChannel,
	PoemmaPromotionAction,
	PoemmaUserRole,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaFormField,
	PoemmaMetricBadge,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaAccessDenied,
	PoemmaPageShell,
} from '../ui';
import {
	POEMMA_PROMOTION_CHECKLIST_ITEMS,
	labelPoemmaPromotionStatus,
	type PoemmaPromotionChecklistKey,
} from './poemmaPromoChecklist';
import { labelPoemmaChannel } from './poemmaPromoDefaults';

export type PoemmaPromoActionPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	promotionId: string;
	onNavigate: (path: string) => void;
};

function PoemmaPromoActionAccessDenied() {
	return (
		<PoemmaAccessDenied description="Чеклист акции доступен только собственнику." />
	);
}

function formatPoemmaMoneyRub(value: number): string {
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value);
}

function parsePoemmaBudgetInput(raw: string): number | null {
	const normalized = raw.replace(/\s/g, '').replace(',', '.');
	if (!normalized) {
		return null;
	}
	const value = Number(normalized);
	return Number.isFinite(value) ? value : null;
}

export function PoemmaPromoActionPage({
	ownerUserId,
	userRole,
	promotionId,
	onNavigate,
}: PoemmaPromoActionPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [promotion, setPromotion] = useState<PoemmaPromotionAction | null>(
		null
	);
	const [channel, setChannel] = useState<PoemmaChannel | null>(null);
	const [nameInput, setNameInput] = useState('');
	const [budgetInput, setBudgetInput] = useState('');
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const loadAction = useCallback(async () => {
		const org = await repository.getOrg();
		const period = await repository.getCurrentPeriod();
		if (!org || !period) {
			setPromotion(null);
			setChannel(null);
			setIsLoaded(true);
			return;
		}

		const nextPromotion = await repository.getPromotion(period.id, promotionId);
		if (!nextPromotion) {
			setPromotion(null);
			setChannel(null);
			setIsLoaded(true);
			return;
		}

		const channels = await repository.listChannels(org.id);
		setPromotion(nextPromotion);
		setChannel(
			channels.find((item) => item.id === nextPromotion.channelId) ?? null
		);
		setNameInput(nextPromotion.name);
		setBudgetInput(
			nextPromotion.budget != null && nextPromotion.budget > 0
				? String(nextPromotion.budget)
				: ''
		);
		setIsLoaded(true);
	}, [promotionId, repository]);

	useEffect(() => {
		if (userRole !== 'owner') {
			setIsLoaded(true);
			return;
		}
		setIsLoaded(false);
		void loadAction();
	}, [loadAction, userRole]);

	async function persistPromotion(next: PoemmaPromotionAction): Promise<void> {
		setIsSaving(true);
		try {
			await repository.savePromotion(next);
			setPromotion(next);
		} finally {
			setIsSaving(false);
		}
	}

	if (userRole !== 'owner') {
		return <PoemmaPromoActionAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем акцию"
				description="Проверяем карточку акции, канал и чеклист."
			/>
		);
	}

	if (!promotion) {
		return (
			<PoemmaPageShell>
				<PoemmaPagePanel>
					<PoemmaPageHeader
						eyebrow={POEMMA_SECTION_EYEBROW.promoAction}
						title="Акция не найдена"
					/>
					<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
						Вернитесь к списку каналов и выберите другую карточку.
					</p>
					<DesktopAppButton
						type="button"
						variant="accent"
						className="mt-4"
						onClick={() => onNavigate('/promo')}
					>
						К каналам
					</DesktopAppButton>
				</PoemmaPagePanel>
			</PoemmaPageShell>
		);
	}

	const activePromotion = promotion;

	async function handleMetaSave(
		event: FormEvent<HTMLFormElement>
	): Promise<void> {
		event.preventDefault();
		const trimmedName = nameInput.trim().slice(0, 40);
		if (!trimmedName) {
			return;
		}
		const budget = parsePoemmaBudgetInput(budgetInput);
		await persistPromotion({
			...activePromotion,
			name: trimmedName,
			budget: budget != null && budget > 0 ? budget : undefined,
		});
	}

	async function toggleChecklist(
		key: PoemmaPromotionChecklistKey
	): Promise<void> {
		await persistPromotion({
			...activePromotion,
			checklist: {
				...activePromotion.checklist,
				[key]: !activePromotion.checklist[key],
			},
		});
	}

	async function setStatus(
		nextStatus: PoemmaPromotionAction['status']
	): Promise<void> {
		await persistPromotion({ ...activePromotion, status: nextStatus });
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Каналы" onBack={() => onNavigate('/promo')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.promoAction}
					title={activePromotion.name}
					description={`Канал: ${channel ? labelPoemmaChannel(channel) : '—'}`}
					meta={
						<PoemmaMetricBadge
							label={labelPoemmaPromotionStatus(activePromotion.status)}
							tone={
								activePromotion.status === 'live'
									? 'success'
									: activePromotion.status === 'ended'
										? 'neutral'
										: 'warning'
							}
						/>
					}
				/>

				<form className="mt-4 grid gap-4" onSubmit={handleMetaSave}>
					<PoemmaFormField label="Название">
						<DesktopAppInput
							type="text"
							maxLength={40}
							aria-label="Название акции"
							value={nameInput}
							onChange={(event) => setNameInput(event.target.value)}
						/>
					</PoemmaFormField>
					<PoemmaFormField label="Бюджет, ₽">
						<DesktopAppInput
							type="text"
							inputMode="decimal"
							aria-label="Бюджет акции"
							value={budgetInput}
							onChange={(event) => setBudgetInput(event.target.value)}
						/>
					</PoemmaFormField>
					<DesktopAppButton type="submit" variant="neutral" disabled={isSaving}>
						{isSaving ? 'Сохраняем…' : 'Сохранить'}
					</DesktopAppButton>
				</form>

				{activePromotion.budget != null && activePromotion.budget > 0 ? (
					<p className="mt-2 text-2xl font-semibold tabular-nums text-(--desktop-text-primary)">
						{formatPoemmaMoneyRub(activePromotion.budget)}
					</p>
				) : null}

				<PoemmaPageSection label="Чеклист" variant="framed">
					<ul className="grid gap-2">
						{POEMMA_PROMOTION_CHECKLIST_ITEMS.map((item) => {
							const checked = activePromotion.checklist[item.key];
							return (
								<li key={item.key}>
									<button
										type="button"
										disabled={isSaving}
										className={cn(
											'flex w-full items-center gap-3 rounded-lg border border-(--desktop-border-subtle) px-3 py-2.5 text-left',
											'hover:bg-(--desktop-surface-muted)'
										)}
										onClick={() => void toggleChecklist(item.key)}
									>
										<span aria-hidden>{checked ? '☑' : '☐'}</span>
										<span className="text-base text-(--desktop-text-primary)">
											{item.label}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</PoemmaPageSection>

				<PoemmaActionRow
					className="mt-6"
					actions={
						<>
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() =>
									onNavigate(
										`/promo/utm${activePromotion.id ? `?promotion=${activePromotion.id}` : ''}`
									)
								}
							>
								Ссылка UTM
							</DesktopAppButton>
							{activePromotion.status === 'draft' ? (
								<DesktopAppButton
									type="button"
									variant="accent"
									disabled={isSaving}
									onClick={() => void setStatus('live')}
								>
									Запустить
								</DesktopAppButton>
							) : null}
							{activePromotion.status === 'live' ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									disabled={isSaving}
									onClick={() => void setStatus('ended')}
								>
									Остановить
								</DesktopAppButton>
							) : null}
						</>
					}
					hint={
						activePromotion.status === 'ended'
							? 'Итог: зафиксируйте решение на карте идей или в закрытии периода.'
							: 'Завершите чеклист перед запуском акции.'
					}
				/>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
