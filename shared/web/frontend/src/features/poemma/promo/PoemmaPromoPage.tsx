/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only `/promo` page: channel health, active promotion cues, and quick entry into promotion actions.
 *
 * Invariants:
 * - Team roles do not access channels/promotions editor.
 * - Promotion and channel data are loaded only via getPoemmaRepository.
 * - "Есть деньги — акция" creates draft promo and routes to action card.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §11
 * - src/features/poemma/promo/PoemmaPromoActionPage.tsx
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	POEMMA_EMPTY_PROMOTION_CHECKLIST,
	type PoemmaChannel,
	type PoemmaPromotionAction,
	type PoemmaUserRole,
} from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaContextCard,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaListRow,
	PoemmaAccessDenied,
	PoemmaPageShell,
} from '../ui';
import {
	createPoemmaPromotionId,
	labelPoemmaChannel,
	labelPoemmaChannelStatus,
} from './poemmaPromoDefaults';

export type PoemmaPromoPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
};

function PoemmaPromoAccessDenied() {
	return (
		<PoemmaAccessDenied description="Команда не видит каналы и акции. Раздел доступен собственнику." />
	);
}

function formatPoemmaPromotionBudget(value: number | undefined): string {
	if (value == null || value <= 0) {
		return '—';
	}
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value);
}

export function PoemmaPromoPage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaPromoPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [channels, setChannels] = useState<PoemmaChannel[]>([]);
	const [promotions, setPromotions] = useState<PoemmaPromotionAction[]>([]);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	const loadPromo = useCallback(async () => {
		const org = await repository.getOrg();
		const period = await repository.getCurrentPeriod();
		if (!org || !period) {
			setChannels([]);
			setPromotions([]);
			setIsLoaded(true);
			return;
		}

		const [nextChannels, nextPromotions] = await Promise.all([
			repository.listChannels(org.id),
			repository.listPromotions(period.id),
		]);
		setChannels(nextChannels);
		setPromotions(nextPromotions);
		setIsLoaded(true);
	}, [repository]);

	useEffect(() => {
		if (userRole !== 'owner') {
			setIsLoaded(true);
			return;
		}
		setIsLoaded(false);
		void loadPromo();
	}, [loadPromo, userRole]);

	if (userRole !== 'owner') {
		return <PoemmaPromoAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем каналы и акции"
				description="Собираем активные каналы и промо-список текущего периода."
			/>
		);
	}

	const hasLivePromotion = promotions.some((item) => item.status === 'live');
	const showNoMoneyBanner = !hasLivePromotion;

	async function handleCreatePromotion(): Promise<void> {
		const org = await repository.getOrg();
		const period = await repository.getCurrentPeriod();
		if (!org || !period || channels.length === 0) {
			return;
		}

		const preferredChannel =
			channels.find((item) => item.type === 'vk') ?? channels[0];
		setIsCreating(true);
		try {
			const promotion: PoemmaPromotionAction = {
				id: createPoemmaPromotionId(),
				periodId: period.id,
				channelId: preferredChannel.id,
				name: 'Новая акция',
				status: 'draft',
				checklist: { ...POEMMA_EMPTY_PROMOTION_CHECKLIST },
			};
			await repository.savePromotion(promotion);
			onNavigate(`/promo/actions/${promotion.id}`);
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.promoChannels}
					title="Каналы"
					description="Спящие каналы — норма. Когда появятся деньги, запускайте акцию и отслеживайте UTM."
				/>

				{showNoMoneyBanner ? (
					<PoemmaPageSection spacing="compact">
						<PoemmaContextCard
							title="Сейчас: денег на рекламу нет"
							description="Каналы спят. Это нормально."
							actions={
								<DesktopAppButton
									type="button"
									variant="accent"
									disabled={isCreating || channels.length === 0}
									onClick={() => void handleCreatePromotion()}
								>
									{isCreating ? 'Создаём…' : 'Есть деньги — акция'}
								</DesktopAppButton>
							}
						/>
					</PoemmaPageSection>
				) : null}

				<PoemmaPageSection label="Каналы">
					<ul className="grid gap-2">
						{channels.map((channel) => (
							<li key={channel.id}>
								<PoemmaListRow className="flex flex-wrap items-center justify-between gap-2">
									<span className="text-base font-semibold text-(--desktop-text-primary)">
										{labelPoemmaChannel(channel)}
									</span>
									<span
										className={cn(
											'text-sm font-semibold',
											channel.status === 'active'
												? 'text-(--desktop-text-primary)'
												: 'text-(--desktop-text-secondary)'
										)}
									>
										{labelPoemmaChannelStatus(channel)}
										{channel.lastActivityNote
											? ` · ${channel.lastActivityNote}`
											: ''}
									</span>
								</PoemmaListRow>
							</li>
						))}
					</ul>
				</PoemmaPageSection>

				<PoemmaPageSection label={`Акции (${promotions.length})`}>
					{promotions.length === 0 ? (
						<p className="text-base leading-7 text-(--desktop-text-secondary)">
							Пока пусто. Когда появятся деньги — создайте акцию.
						</p>
					) : (
						<ul className="grid gap-2">
							{promotions.map((promotion) => (
								<li key={promotion.id}>
									<DesktopAppButton
										type="button"
										variant="neutral"
										className="w-full justify-between"
										onClick={() => onNavigate(`/promo/actions/${promotion.id}`)}
									>
										<span>{promotion.name}</span>
										<span className="text-sm text-(--desktop-text-secondary)">
											{formatPoemmaPromotionBudget(promotion.budget)}
										</span>
									</DesktopAppButton>
								</li>
							))}
						</ul>
					)}
				</PoemmaPageSection>

				<PoemmaActionRow
					className="mt-6"
					actions={
						<DesktopAppButton
							type="button"
							variant="ghost"
							onClick={() => onNavigate('/promo/utm')}
						>
							Ссылки UTM →
						</DesktopAppButton>
					}
					hint="Сгенерируйте отслеживаемые ссылки для запущенных акций."
				/>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
