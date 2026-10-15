/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only `/promo/utm` page for composing, copying, and persisting UTM links.
 *
 * Invariants:
 * - Generated URL is built through domain helper buildPoemmaUtmUrl.
 * - Saved links are workspace-scoped and loaded via getPoemmaRepository.
 * - Team roles do not access UTM constructor.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §13
 * - src/features/poemma/promo/poemmaUtm.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopAppButton,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { PoemmaUtmLink, PoemmaUserRole } from '../poemmaDomain';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaActionRow,
	PoemmaFormField,
	PoemmaNavRail,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaAccessDenied,
	PoemmaPageShell,
	POEMMA_CONTEXT_CARD_CLASS,
} from '../ui';
import { createPoemmaUtmLinkId } from './poemmaPromoDefaults';
import { buildPoemmaUtmUrl } from './poemmaUtm';

const POEMMA_UTM_HELP = 'Чтобы видеть, откуда пришли на сайт';

export type PoemmaUtmPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	promotionId?: string;
	onNavigate: (path: string) => void;
};

function PoemmaUtmAccessDenied() {
	return (
		<PoemmaAccessDenied description="Генератор ссылок доступен только собственнику." />
	);
}

async function copyPoemmaText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export function PoemmaUtmPage({
	ownerUserId,
	userRole,
	promotionId,
	onNavigate,
}: PoemmaUtmPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const [baseUrl, setBaseUrl] = useState('https://');
	const [utmSource, setUtmSource] = useState('');
	const [utmCampaign, setUtmCampaign] = useState('');
	const [savedLinks, setSavedLinks] = useState<PoemmaUtmLink[]>([]);
	const [copyMessage, setCopyMessage] = useState<string | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const generatedUrl = useMemo(
		() =>
			buildPoemmaUtmUrl({
				baseUrl,
				utmSource,
				utmCampaign,
				utmMedium: 'cpc',
			}),
		[baseUrl, utmCampaign, utmSource]
	);

	const loadUtm = useCallback(async () => {
		const org = await repository.getOrg();
		if (!org) {
			setSavedLinks([]);
			setIsLoaded(true);
			return;
		}
		const links = await repository.listUtmLinks(org.id);
		setSavedLinks(links);
		setIsLoaded(true);
	}, [repository]);

	useEffect(() => {
		if (userRole !== 'owner') {
			setIsLoaded(true);
			return;
		}
		setIsLoaded(false);
		void loadUtm();
	}, [loadUtm, userRole]);

	if (userRole !== 'owner') {
		return <PoemmaUtmAccessDenied />;
	}

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем UTM-ссылки"
				description="Подтягиваем сохранённые ссылки и готовим генератор."
			/>
		);
	}

	async function handleCopy(): Promise<void> {
		if (!generatedUrl) {
			return;
		}
		const ok = await copyPoemmaText(generatedUrl);
		setCopyMessage(ok ? 'Скопировано' : 'Не удалось скопировать');
	}

	async function handleSaveLink(): Promise<void> {
		if (!generatedUrl) {
			return;
		}
		const org = await repository.getOrg();
		if (!org) {
			return;
		}

		setIsSaving(true);
		try {
			const link: PoemmaUtmLink = {
				id: createPoemmaUtmLinkId(),
				promotionId,
				baseUrl: baseUrl.trim(),
				utmSource: utmSource.trim(),
				utmMedium: 'cpc',
				utmCampaign: utmCampaign.trim(),
				generatedUrl,
			};
			await repository.saveUtmLink(org.id, link);
			const links = await repository.listUtmLinks(org.id);
			setSavedLinks(links);
			setCopyMessage('Сохранено');
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Каналы" onBack={() => onNavigate('/promo')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.promoLinks}
					title="Ссылки"
					description={`Зачем? ${POEMMA_UTM_HELP}`}
				/>

				<PoemmaPageSection label="Параметры" spacing="compact">
					<div className="grid gap-4">
						<PoemmaFormField label="Сайт">
							<DesktopAppInput
								type="url"
								aria-label="Адрес сайта"
								value={baseUrl}
								onChange={(event) => {
									setBaseUrl(event.target.value);
									setCopyMessage(null);
								}}
							/>
						</PoemmaFormField>
						<PoemmaFormField label="Источник">
							<DesktopAppInput
								type="text"
								aria-label="utm_source"
								placeholder="vk"
								value={utmSource}
								onChange={(event) => {
									setUtmSource(event.target.value);
									setCopyMessage(null);
								}}
							/>
						</PoemmaFormField>
						<PoemmaFormField label="Кампания">
							<DesktopAppInput
								type="text"
								aria-label="utm_campaign"
								placeholder="leto2026"
								value={utmCampaign}
								onChange={(event) => {
									setUtmCampaign(event.target.value);
									setCopyMessage(null);
								}}
							/>
						</PoemmaFormField>
					</div>
				</PoemmaPageSection>

				<PoemmaPageSection label="Готовая ссылка">
					<div className={POEMMA_CONTEXT_CARD_CLASS}>
						<p className="break-all text-sm text-(--desktop-text-primary)">
							{generatedUrl ?? 'Заполните сайт, источник и кампанию'}
						</p>
					</div>
					<PoemmaActionRow
						actions={
							<>
								<DesktopAppButton
									type="button"
									variant="accent"
									disabled={!generatedUrl}
									onClick={() => void handleCopy()}
								>
									Копировать
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="neutral"
									disabled={!generatedUrl || isSaving}
									onClick={() => void handleSaveLink()}
								>
									{isSaving ? 'Сохраняем…' : 'Сохранить'}
								</DesktopAppButton>
							</>
						}
						hint={copyMessage ?? undefined}
					/>
				</PoemmaPageSection>

				<PoemmaPageSection label="Сохранённые">
					{savedLinks.length === 0 ? (
						<p className="text-base leading-7 text-(--desktop-text-secondary)">
							Пока пусто.
						</p>
					) : (
						<ul className="grid gap-2">
							{[...savedLinks].reverse().map((link) => (
								<li key={link.id} className={POEMMA_CONTEXT_CARD_CLASS}>
									<p className="text-sm font-semibold text-(--desktop-text-secondary)">
										{link.utmSource} · {link.utmCampaign}
									</p>
									<p className="break-all text-sm text-(--desktop-text-primary)">
										{link.generatedUrl}
									</p>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="justify-start"
										onClick={() => void copyPoemmaText(link.generatedUrl)}
									>
										Копировать
									</DesktopAppButton>
								</li>
							))}
						</ul>
					)}
				</PoemmaPageSection>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
