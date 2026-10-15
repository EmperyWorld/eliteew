/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared formatters and small predicates for Site Manager Ops panel labels.
 *
 * Invariants:
 * - Formatters are pure; they do not call Site Manager APIs.
 * - Missing/unknown values render as em dash or localized unknownStatus.
 *
 * Related:
 * - ../api.ts
 * - ./SiteManagerOpsPanel.tsx
 * - documentation/product/SITE-STUDIO.md
 */
import type { TFunction } from 'i18next';

import type {
	SiteManagerOpsAuditEvent,
	SiteManagerOpsRuntimeInstance,
	SiteManagerOpsTemplateRegistry,
} from '../../api';
import type { SiteManagerUxSiteCard } from '../../siteManagerUserStatus';

export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatTranslatedValue(
	t: TFunction<'siteStudio'>,
	prefix: string,
	value: string | null | undefined
): string {
	if (!value) return '—';
	const translated = t(`${prefix}.${value}`, { defaultValue: value });
	return translated === value ? t('siteManager.unknownStatus') : translated;
}

export function isAttentionSiteCard(card: SiteManagerUxSiteCard): boolean {
	return (
		card.state === 'needs_attention' ||
		card.state === 'domain_pending' ||
		card.state === 'launching'
	);
}

export function formatTemplateSummary(
	t: TFunction<'siteStudio'>,
	template: SiteManagerOpsTemplateRegistry['templates'][number]
): string {
	return [
		t('siteManager.operatorDetails.templateBlocks', {
			count: template.block_count,
		}),
		t('siteManager.operatorDetails.templateRuntime', {
			mode: formatTranslatedValue(
				t,
				'siteManager.runtimeMode',
				template.runtime_mode
			),
		}),
		t(
			template.images_ready
				? 'siteManager.operatorDetails.templateImagesReady'
				: 'siteManager.operatorDetails.templateImagesMissing'
		),
	].join(' · ');
}

export function formatAuditTarget(
	t: TFunction<'siteStudio'>,
	event: SiteManagerOpsAuditEvent
): string {
	return [
		formatTranslatedValue(t, 'siteManager.auditTarget', event.target_type),
		event.target_id ?? '—',
		formatDate(event.created_at),
	].join(' · ');
}

export function formatInstanceSearchSummary(
	t: TFunction<'siteStudio'>,
	instance: SiteManagerOpsRuntimeInstance
): string {
	return [
		formatTranslatedValue(t, 'siteManager.scope', instance.instance_scope),
		instance.site_slug,
		formatTranslatedValue(t, 'siteManager.instanceStatus', instance.status),
		instance.publication_state,
	].join(' · ');
}
