/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-listing publication channel rows: list, upsert, and status patch via Realtor Pro marketing REST.
 *
 * Invariants:
 * - Channel keys use preset list with custom fallback label; status transitions are pending/published/failed only.
 * - Loads channels when `property` changes; empty state when no listing is selected.
 *
 * Related:
 * - ../RealtorProPanels.tsx
 * - ../../api.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
} from '../../layout';

import {
	listRealtorPublicationChannels,
	patchRealtorPublicationChannel,
	upsertRealtorPublicationChannel,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import type { RealtorProperty, RealtorPublicationChannel } from '../../types';

type RealtorPanelTranslate = (
	key: string,
	options?: Record<string, unknown>
) => string;

function humanizeRealtorIdentifier(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatUnknownRealtorValue(
	t: RealtorPanelTranslate,
	value: string | null | undefined
): string {
	const humanValue = humanizeRealtorIdentifier(value?.trim() || '');
	return humanValue
		? t('realtorPro.formatters.customValue', { value: humanValue })
		: t('realtorPro.formatters.notSpecified');
}

function translateRealtorValue(
	t: RealtorPanelTranslate,
	key: string,
	fallback: string
): string {
	const value = t(key);
	return value === key ? fallback : value;
}

function formatPublicationChannelLabel(
	t: RealtorPanelTranslate,
	channelKey: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.marketing.publicationChannelNames.${channelKey}`,
		t('realtorPro.marketing.publicationChannelCustom', {
			channel: humanizeRealtorIdentifier(channelKey),
		})
	);
}

function formatPublicationStatusLabel(
	t: RealtorPanelTranslate,
	status: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.marketing.publicationStatuses.${status}`,
		formatUnknownRealtorValue(t, status)
	);
}

function PanelStatus({
	error,
	loading,
}: {
	error: string | null;
	loading: boolean;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	if (loading) {
		return (
			<span className="text-xs text-(--desktop-text-muted)">
				{t('realtorPro.loading')}
			</span>
		);
	}
	if (error) {
		return (
			<ProfessionalWorldsStatusBanner kind="error" className="max-w-md">
				{error}
			</ProfessionalWorldsStatusBanner>
		);
	}
	return null;
}

const PUBLICATION_CHANNEL_PRESETS = [
	'vk',
	'telegram',
	'avito',
	'cian',
	'site',
] as const;

const PUBLICATION_CHANNEL_STATUSES = [
	'pending',
	'published',
	'failed',
] as const;

export function PublicationChannelsPanel({
	property,
}: {
	property: RealtorProperty | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const [channels, setChannels] = useState<RealtorPublicationChannel[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [draftChannelKey, setDraftChannelKey] = useState<string>(
		PUBLICATION_CHANNEL_PRESETS[0]
	);
	const [saving, setSaving] = useState(false);

	const reloadChannels = useCallback(
		async (listingId: string) => {
			if (!listingId) {
				setChannels([]);
				setError(null);
				setLoading(false);
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const rows = await listRealtorPublicationChannels(listingId);
				setChannels(rows);
			} catch (caught: unknown) {
				setChannels([]);
				setError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			} finally {
				setLoading(false);
			}
		},
		[t]
	);

	useEffect(() => {
		if (!property) {
			setChannels([]);
			return;
		}
		void reloadChannels(property.id);
	}, [property, reloadChannels]);

	async function handleAddChannel() {
		if (!property || !draftChannelKey.trim()) return;
		setSaving(true);
		setError(null);
		try {
			const row = await upsertRealtorPublicationChannel(property.id, {
				channel_key: draftChannelKey.trim(),
				status: 'pending',
			});
			setChannels((current) => [
				row,
				...current.filter((item) => item.channel_key !== row.channel_key),
			]);
			notifySuccess(t('realtorPro.marketing.publicationChannelAddSuccess'));
		} catch (caught: unknown) {
			setError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			notifyApiError(
				caught,
				t,
				t('realtorPro.marketing.publicationChannelAddFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleStatusChange(
		channelId: string,
		status: (typeof PUBLICATION_CHANNEL_STATUSES)[number]
	) {
		setError(null);
		try {
			const row = await patchRealtorPublicationChannel(channelId, { status });
			setChannels((current) =>
				current.map((item) => (item.id === row.id ? row : item))
			);
		} catch (caught: unknown) {
			setError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			notifyApiError(
				caught,
				t,
				t('realtorPro.marketing.publicationChannelStatusFailed')
			);
		}
	}

	return (
		<div className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<strong className="text-sm">
					{t('realtorPro.marketing.publicationChannelsTitle')}
				</strong>
				<PanelStatus error={error} loading={loading} />
			</div>
			<p className="text-xs text-(--desktop-text-muted)">
				{t('realtorPro.marketing.publicationChannelsHint')}
			</p>
			<div className="flex flex-wrap items-end gap-2">
				<ProfessionalWorldsFormField
					label={t('realtorPro.marketing.publicationChannelKeyLabel')}
				>
					<DesktopNativeSelect
						value={draftChannelKey}
						onChange={(event) => setDraftChannelKey(event.target.value)}
					>
						{PUBLICATION_CHANNEL_PRESETS.map((key) => (
							<option key={key} value={key}>
								{formatPublicationChannelLabel(t, key)}
							</option>
						))}
					</DesktopNativeSelect>
				</ProfessionalWorldsFormField>
				<DesktopAppButton
					size="sm"
					disabled={!property || saving}
					onClick={() => void handleAddChannel()}
				>
					{t('realtorPro.marketing.publicationChannelAdd')}
				</DesktopAppButton>
			</div>
			{!loading && channels.length === 0 ? (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.marketing.publicationChannelsEmpty')}
				</p>
			) : (
				<div className="grid gap-2">
					{channels.map((channel) => (
						<article
							key={channel.id}
							className="flex flex-wrap items-center justify-between gap-2 rounded-(--desktop-radius) bg-(--desktop-surface) p-2 text-sm"
						>
							<div>
								<strong>
									{formatPublicationChannelLabel(t, channel.channel_key)}
								</strong>
								<p className="text-xs text-(--desktop-text-secondary)">
									{formatPublicationStatusLabel(t, channel.status)}
								</p>
							</div>
							<DesktopNativeSelect
								value={channel.status}
								onChange={(event) =>
									void handleStatusChange(
										channel.id,
										event.target
											.value as (typeof PUBLICATION_CHANNEL_STATUSES)[number]
									)
								}
								aria-label={t(
									'realtorPro.marketing.publicationChannelStatusAria',
									{ channel: channel.channel_key }
								)}
							>
								{PUBLICATION_CHANNEL_STATUSES.map((status) => (
									<option key={status} value={status}>
										{formatPublicationStatusLabel(t, status)}
									</option>
								))}
							</DesktopNativeSelect>
						</article>
					))}
				</div>
			)}
		</div>
	);
}
