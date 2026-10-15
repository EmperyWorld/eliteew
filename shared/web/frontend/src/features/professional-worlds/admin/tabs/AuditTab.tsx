/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Filterable admin audit explorer for Professional Worlds: operator workflow copy, labeled filter fields with hints, event list + JSON drilldown, reset to unfiltered fetch.
 *
 * Invariants:
 * - Read-only; this tab never mutates Professional Worlds configuration.
 * - Drilldown payloads are admin-only snapshots and must not be reused by runtime UI.
 * - Server fetch uses a hard cap (`AUDIT_FETCH_LIMIT`); client pagination only pages the loaded batch.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	AdminButton,
	AdminField,
	AdminJsonPreview,
	AdminStatusBanner,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import { listProfessionalWorldsAudit } from '../api';
import type {
	ProfessionalAdminAuditLog,
	ProfessionalWorldsAdminSnapshot,
} from '../types';

const PAGE_SIZE = 10;
const AUDIT_FETCH_LIMIT = 200;

function formatAuditRiskLabel(
	level: string | null | undefined,
	normalLabel: string
): string {
	if (level === null || level === undefined || level.trim() === '') {
		return normalLabel;
	}
	return level.trim().toLowerCase() === 'normal' ? normalLabel : level;
}

function formatAuditActorLabel(
	actorId: string | null | undefined,
	systemLabel: string
): string {
	if (actorId === null || actorId === undefined || actorId.trim() === '') {
		return systemLabel;
	}
	return actorId;
}

function humanizeAuditValue(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function translateAuditValue(
	t: ReturnType<typeof useTranslation>['t'],
	scope: 'actionLabels' | 'entityTypes',
	value: string | null | undefined
): string {
	const normalized = value?.trim() || 'unknown';
	return t(`admin.audit.${scope}.${normalized}`, {
		defaultValue: t('admin.audit.customValueLabel', {
			value: humanizeAuditValue(normalized),
		}),
	});
}

type AuditFilterQuery = {
	entity_type?: string;
	risk_level?: string;
	admin_user_id?: string;
};

function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
			<h3 className="mb-3 text-sm font-semibold text-[var(--admin-ui-fg)]">
				{title}
			</h3>
			{children}
		</section>
	);
}

export function AuditTab({
	snapshot,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [events, setEvents] = useState<ProfessionalAdminAuditLog[]>(
		snapshot.audit
	);
	const [entityType, setEntityType] = useState('');
	const [riskLevel, setRiskLevel] = useState('');
	const [actorId, setActorId] = useState('');
	const [page, setPage] = useState(0);
	const [selectedEvent, setSelectedEvent] =
		useState<ProfessionalAdminAuditLog | null>(snapshot.audit[0] ?? null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
	const pageEvents = useMemo(
		() => events.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
		[events, page]
	);
	const selectedActionLabel = selectedEvent
		? translateAuditValue(t, 'actionLabels', selectedEvent.action)
		: '';
	const selectedEntityTypeLabel = selectedEvent
		? translateAuditValue(t, 'entityTypes', selectedEvent.entity_type)
		: '';

	async function loadAudit(filters: AuditFilterQuery) {
		setLoading(true);
		setError(null);
		try {
			const rows = await listProfessionalWorldsAudit({
				entity_type: filters.entity_type || undefined,
				risk_level: filters.risk_level || undefined,
				admin_user_id: filters.admin_user_id || undefined,
				limit: AUDIT_FETCH_LIMIT,
			});
			setEvents(rows);
			setSelectedEvent(rows[0] ?? null);
			setPage(0);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.loadAudit')
			);
		} finally {
			setLoading(false);
		}
	}

	async function applyFilters() {
		await loadAudit({
			entity_type: entityType,
			risk_level: riskLevel,
			admin_user_id: actorId,
		});
	}

	async function resetFilters() {
		setEntityType('');
		setRiskLevel('');
		setActorId('');
		await loadAudit({});
	}

	return (
		<div className="grid gap-4">
			<Panel title={t('admin.audit.workflowTitle')}>
				<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
					{t('admin.audit.workflowIntro', { pageSize: PAGE_SIZE })}
				</p>
				<ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
					<li>{t('admin.audit.workflowStep1')}</li>
					<li>{t('admin.audit.workflowStep2')}</li>
					<li>{t('admin.audit.workflowStep3')}</li>
					<li>{t('admin.audit.workflowStep4')}</li>
				</ol>
			</Panel>
			<div className="grid gap-4 xl:grid-cols-[420px_1fr]">
				<Panel title={t('admin.audit.filtersTitle')}>
					<div className="grid gap-3">
						<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
							{t('admin.audit.filtersIntro')}
						</p>
						<div className="grid gap-1">
							<label
								className="text-sm text-[var(--admin-ui-fg)]"
								htmlFor="pw-admin-audit-entity-type"
							>
								{t('admin.audit.entityTypeLabel')}
							</label>
							<AdminField
								id="pw-admin-audit-entity-type"
								data-testid="pw-admin-audit-entity-type"
								value={entityType}
								onChange={(event) => setEntityType(event.target.value)}
								placeholder={t('admin.audit.entityTypePlaceholder')}
							/>
							<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
								{t('admin.audit.helpEntityType')}
							</p>
						</div>
						<div className="grid gap-1">
							<label
								className="text-sm text-[var(--admin-ui-fg)]"
								htmlFor="pw-admin-audit-risk-level"
							>
								{t('admin.audit.riskLevelLabel')}
							</label>
							<AdminField
								id="pw-admin-audit-risk-level"
								data-testid="pw-admin-audit-risk-level"
								value={riskLevel}
								onChange={(event) => setRiskLevel(event.target.value)}
								placeholder={t('admin.audit.riskLevelPlaceholder')}
							/>
							<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
								{t('admin.audit.helpRiskLevel')}
							</p>
						</div>
						<div className="grid gap-1">
							<label
								className="text-sm text-[var(--admin-ui-fg)]"
								htmlFor="pw-admin-audit-actor-id"
							>
								{t('admin.audit.actorIdLabel')}
							</label>
							<AdminField
								id="pw-admin-audit-actor-id"
								data-testid="pw-admin-audit-actor-id"
								value={actorId}
								onChange={(event) => setActorId(event.target.value)}
								placeholder={t('admin.audit.actorIdPlaceholder')}
							/>
							<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
								{t('admin.audit.helpActorId')}
							</p>
						</div>
						<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
							{t('admin.audit.fetchLimitNote', { limit: AUDIT_FETCH_LIMIT })}
						</p>
						<div className="flex flex-wrap gap-2">
							<AdminButton
								data-testid="pw-admin-audit-apply"
								variant="primary"
								onClick={() => void applyFilters()}
								disabled={loading}
							>
								{loading
									? t('admin.status.loading')
									: t('admin.audit.applyFilters')}
							</AdminButton>
							<AdminButton
								data-testid="pw-admin-audit-reset"
								variant="secondary"
								onClick={() => void resetFilters()}
								disabled={loading}
							>
								{t('admin.audit.resetFilters')}
							</AdminButton>
						</div>
						{error ? (
							<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
						) : null}
					</div>
				</Panel>
				<div className="grid gap-4">
					<Panel title={t('admin.audit.eventsTitle')}>
						<div className="grid gap-3">
							<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
								{t('admin.audit.eventsListLead')}
							</p>
							{events.length === 0 ? (
								<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-4">
									<p className="font-medium text-[var(--admin-ui-fg)]">
										{t('admin.audit.emptyEventsTitle')}
									</p>
									<p className="mt-2 text-sm text-[var(--admin-ui-fg-muted)]">
										{t('admin.audit.emptyEventsLead')}
									</p>
								</div>
							) : (
								<>
									{pageEvents.map((event) => {
										const actionLabel = translateAuditValue(
											t,
											'actionLabels',
											event.action
										);
										const entityLabel = translateAuditValue(
											t,
											'entityTypes',
											event.entity_type
										);
										return (
											<button
												key={event.id}
												data-testid={`pw-admin-audit-event-${event.id}`}
												type="button"
												onClick={() => setSelectedEvent(event)}
												aria-current={
													selectedEvent?.id === event.id ? true : undefined
												}
												className={cn(
													'rounded-[var(--admin-ui-radius)] border p-3 text-left transition-colors',
													selectedEvent?.id === event.id
														? 'border-[var(--admin-ui-accent)] bg-[var(--admin-ui-accent)]/10 ring-1 ring-[var(--admin-ui-accent)]/40'
														: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] hover:bg-[var(--admin-ui-surface)]'
												)}
											>
												<div className="flex items-center justify-between gap-3">
													<strong className="text-[var(--admin-ui-fg)]">
														{actionLabel}
													</strong>
													<span className="text-xs text-[var(--admin-ui-fg-muted)]">
														{new Date(event.created_at).toLocaleString()}
													</span>
												</div>
												<p className="mt-1 text-sm text-[var(--admin-ui-fg-muted)]">
													{t('admin.audit.eventSummaryLine', {
														entityType: entityLabel,
														entityKey: event.entity_key,
													})}
												</p>
												<div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--admin-ui-fg-muted)]">
													<span>
														{t('admin.audit.riskValue', {
															risk: formatAuditRiskLabel(
																event.risk_level,
																t('admin.audit.riskLevelNormal')
															),
														})}
													</span>
													<span>
														{t('admin.audit.actorValue', {
															actor: formatAuditActorLabel(
																event.admin_user_id,
																t('admin.audit.actorSystem')
															),
														})}
													</span>
												</div>
											</button>
										);
									})}
									<div className="flex items-center justify-between gap-3 text-sm text-[var(--admin-ui-fg)]">
										<AdminButton
											variant="secondary"
											onClick={() =>
												setPage((current) => Math.max(0, current - 1))
											}
											disabled={page === 0}
										>
											{t('admin.audit.paginationPrev')}
										</AdminButton>
										<span>
											{t('admin.audit.pageIndicator', {
												current: page + 1,
												total: pageCount,
											})}
										</span>
										<AdminButton
											variant="secondary"
											onClick={() =>
												setPage((current) =>
													Math.min(pageCount - 1, current + 1)
												)
											}
											disabled={page >= pageCount - 1}
										>
											{t('admin.audit.paginationNext')}
										</AdminButton>
									</div>
								</>
							)}
						</div>
					</Panel>
					<Panel title={t('admin.audit.drilldownTitle')}>
						{selectedEvent ? (
							<div className="grid gap-3">
								<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
									{t('admin.audit.drilldownIntro')}
								</p>
								<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3">
									<strong className="text-[var(--admin-ui-fg)]">
										{selectedEvent.entity_key}
									</strong>
									<p className="text-sm text-[var(--admin-ui-fg-muted)]">
										{t('admin.audit.eventSummaryLine', {
											entityType: selectedEntityTypeLabel,
											entityKey: selectedEvent.entity_key,
										})}
									</p>
									<p className="text-xs text-[var(--admin-ui-fg-muted)]">
										{selectedActionLabel}
									</p>
								</div>
								<AdminJsonPreview
									value={selectedEvent.before_data}
									title={t('admin.audit.beforeLabel')}
									helper={t('admin.audit.beforeHelper')}
									defaultCollapsed
								/>
								<AdminJsonPreview
									value={selectedEvent.after_data}
									title={t('admin.audit.afterLabel')}
									helper={t('admin.audit.afterHelper')}
								/>
							</div>
						) : (
							<p className="text-sm text-[var(--admin-ui-fg-muted)]">
								{t('admin.audit.noEventSelected')}
							</p>
						)}
					</Panel>
				</div>
			</div>
		</div>
	);
}
