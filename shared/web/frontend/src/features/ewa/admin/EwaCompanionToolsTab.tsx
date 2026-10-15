/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWA companion admin — Tools catalog tab with capability grouping and localized descriptions.
 *
 * Related:
 * - src/features/ewa/admin/ewaCompanionAdminApi.ts
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import {
	EWA_TOOL_CAPABILITY_ORDER,
	toolCapabilityHintI18nKey,
	toolCapabilityI18nKey,
	toolDescriptionI18nKey,
} from './ewaCompanionAdminMeta';
import { EwaCompanionAdminBoolBadge } from './EwaCompanionAdminBoolBadge';
import type {
	EwaCompanionToolCatalogEntry,
	EwaCompanionToolRouterRuntime,
} from './ewaCompanionAdminApi';

function ToolDescription({
	tool,
	expanded,
	onToggle,
}: {
	tool: EwaCompanionToolCatalogEntry;
	expanded: boolean;
	onToggle: () => void;
}) {
	const { t, i18n } = useTranslation('desktopUi');
	const localized = t(toolDescriptionI18nKey(tool.name), { defaultValue: '' });
	const text =
		(i18n.language.startsWith('ru') && localized.trim()) ||
		tool.summary.trim() ||
		t('ewaCompanionAdmin.toolDescMissing');

	return (
		<div className="max-w-2xl space-y-2">
			<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
				{text}
			</p>
			<button
				type="button"
				className={`${DESKTOP_TYPOGRAPHY.meta} text-[rgb(var(--desktop-accent-rgb)/0.9)] hover:text-[rgb(var(--desktop-accent-rgb)/0.9)]`}
				onClick={onToggle}
			>
				{expanded
					? t('ewaCompanionAdmin.toolsHideContract')
					: t('ewaCompanionAdmin.toolsShowContract')}
			</button>
			{expanded ? (
				<div className="space-y-1 rounded-md border border-white/10 bg-black/20 p-2 text-xs text-(--desktop-text-muted)">
					{(() => {
						const requires = tool.requires ?? [];
						const inputKeys = tool.input_keys ?? [];
						const resultKeys = tool.result_keys ?? [];
						const stepKinds = tool.step_kinds ?? [];
						return (
							<>
								<p>
									<span className="text-(--desktop-text-dim)">
										{t('ewaCompanionAdmin.toolsRequires')}:
									</span>{' '}
									{requires.length > 0 ? requires.join(', ') : '—'}
								</p>
								<p>
									<span className="text-(--desktop-text-dim)">
										{t('ewaCompanionAdmin.toolsInputKeys')}:
									</span>{' '}
									{inputKeys.length > 0 ? inputKeys.join(', ') : '—'}
								</p>
								<p>
									<span className="text-(--desktop-text-dim)">
										{t('ewaCompanionAdmin.toolsResultKeys')}:
									</span>{' '}
									{resultKeys.length > 0 ? resultKeys.join(', ') : '—'}
								</p>
								{stepKinds.length > 0 ? (
									<p>
										<span className="text-(--desktop-text-dim)">
											{t('ewaCompanionAdmin.toolsStepKinds')}:
										</span>{' '}
										{stepKinds.join(', ')}
									</p>
								) : null}
							</>
						);
					})()}
				</div>
			) : null}
		</div>
	);
}

function ToolsTableBody({ tools }: { tools: EwaCompanionToolCatalogEntry[] }) {
	const { t } = useTranslation('desktopUi');
	const [expanded, setExpanded] = useState<string | null>(null);

	return (
		<div className="overflow-auto rounded-lg border border-white/10">
			<table className="min-w-full text-left text-sm text-(--desktop-text-primary)">
				<thead className="bg-white/4 text-xs uppercase tracking-wide text-(--desktop-text-muted)">
					<tr>
						<th className="px-3 py-2">{t('ewaCompanionAdmin.colName')}</th>
						<th className="px-3 py-2 min-w-[18rem]">
							{t('ewaCompanionAdmin.colDescription')}
						</th>
						<th className="px-3 py-2">{t('ewaCompanionAdmin.colMode')}</th>
						<th className="px-3 py-2">{t('ewaCompanionAdmin.colRouter')}</th>
						<th className="px-3 py-2">{t('ewaCompanionAdmin.colHandler')}</th>
						<th className="px-3 py-2">
							{t('ewaCompanionAdmin.colMaxConcurrent')}
						</th>
					</tr>
				</thead>
				<tbody>
					{tools.map((tool) => (
						<tr key={tool.name} className="border-t border-white/5 align-top">
							<td className="px-3 py-3 font-medium text-white">{tool.name}</td>
							<td className="px-3 py-3">
								<ToolDescription
									tool={tool}
									expanded={expanded === tool.name}
									onToggle={() =>
										setExpanded((cur) => (cur === tool.name ? null : tool.name))
									}
								/>
							</td>
							<td className="px-3 py-3">{tool.execution_mode}</td>
							<td className="px-3 py-3">
								<div className="flex flex-col gap-1">
									<span>
										{t('ewaCompanionAdmin.routerExposed')}{' '}
										<EwaCompanionAdminBoolBadge value={tool.router_exposed} />
									</span>
									<span>
										{t('ewaCompanionAdmin.routerPartial')}{' '}
										<EwaCompanionAdminBoolBadge value={tool.router_partial} />
									</span>
								</div>
							</td>
							<td className="px-3 py-3">
								<EwaCompanionAdminBoolBadge value={tool.handler_registered} />
							</td>
							<td className="px-3 py-3">{tool.max_concurrent_per_principal}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function EwaCompanionToolsTab({
	tools,
	routerRuntime,
}: {
	tools: EwaCompanionToolCatalogEntry[];
	routerRuntime: EwaCompanionToolRouterRuntime | null;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [filter, setFilter] = useState('');
	const [capability, setCapability] = useState<string>('all');
	const routerCoverage = useMemo(() => {
		const exposed = tools.filter((tool) => tool.router_exposed);
		const missingHandlers = exposed.filter((tool) => !tool.handler_registered);
		return {
			exposedCount: exposed.length,
			missingHandlers: missingHandlers.length,
		};
	}, [tools]);

	const capabilities = useMemo(() => {
		const set = new Set<string>();
		for (const tool of tools) {
			set.add(tool.capability || 'general');
		}
		return [
			'all',
			...EWA_TOOL_CAPABILITY_ORDER.filter((c) => set.has(c)),
			...[...set]
				.filter((c) => !EWA_TOOL_CAPABILITY_ORDER.includes(c as never))
				.sort(),
		];
	}, [tools]);

	const filtered = useMemo(() => {
		const needle = filter.trim().toLowerCase();
		return tools.filter((tool) => {
			if (capability !== 'all' && tool.capability !== capability) {
				return false;
			}
			if (!needle) {
				return true;
			}
			const localized = t(toolDescriptionI18nKey(tool.name), {
				defaultValue: '',
			});
			return (
				tool.name.toLowerCase().includes(needle) ||
				tool.summary.toLowerCase().includes(needle) ||
				localized.toLowerCase().includes(needle) ||
				tool.capability.toLowerCase().includes(needle)
			);
		});
	}, [tools, filter, capability, t]);

	const grouped = useMemo(() => {
		if (capability !== 'all') {
			return [{ cap: capability, items: filtered }];
		}
		const map = new Map<string, EwaCompanionToolCatalogEntry[]>();
		for (const tool of filtered) {
			const cap = tool.capability || 'general';
			const list = map.get(cap) ?? [];
			list.push(tool);
			map.set(cap, list);
		}
		const order = [
			...EWA_TOOL_CAPABILITY_ORDER.filter((c) => map.has(c)),
			...[...map.keys()]
				.filter((c) => !EWA_TOOL_CAPABILITY_ORDER.includes(c as never))
				.sort(),
		];
		return order.map((cap) => ({ cap, items: map.get(cap) ?? [] }));
	}, [filtered, capability]);

	const capabilityLabel = (cap: string) => {
		if (cap === 'all') {
			return t('ewaCompanionAdmin.toolsCapabilityAll');
		}
		const title = t(toolCapabilityI18nKey(cap), { defaultValue: cap });
		const count =
			cap === 'all'
				? tools.length
				: tools.filter((x) => (x.capability || 'general') === cap).length;
		return `${title} (${count})`;
	};

	return (
		<div className="space-y-4">
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
				{t('ewaCompanionAdmin.toolsIntro')}
			</p>
			{routerRuntime ? (
				<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-(--desktop-text-secondary)">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium text-(--desktop-text-primary)">
							{t('ewaCompanionAdmin.colRouter')}:
						</span>
						<span>
							{t('ewaCompanionAdmin.routerExposed')}{' '}
							{routerCoverage.exposedCount}
						</span>
						<span>
							{t('ewaCompanionAdmin.colHandler')}{' '}
							{routerCoverage.exposedCount - routerCoverage.missingHandlers}/
							{routerCoverage.exposedCount}
						</span>
						<span>mode={routerRuntime.mode}</span>
						<span>
							enabled=
							<EwaCompanionAdminBoolBadge value={routerRuntime.enabled} />
						</span>
						<span>
							.141=
							<EwaCompanionAdminBoolBadge value={routerRuntime.uses_gpu141} />
						</span>
					</div>
					<p className="mt-1 text-(--desktop-text-muted)">
						{routerRuntime.base_url || '—'} · {routerRuntime.model || '—'}
					</p>
				</div>
			) : null}
			<div className="flex flex-wrap gap-2">
				{capabilities.map((cap) => (
					<button
						key={cap}
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-xs ${
							capability === cap
								? 'bg-[rgb(var(--desktop-accent-rgb)/0.35)] text-white ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.4)]'
								: 'bg-white/5 text-(--desktop-text-secondary) hover:bg-white/8'
						}`}
						onClick={() => setCapability(cap)}
					>
						{capabilityLabel(cap)}
					</button>
				))}
			</div>
			{capability !== 'all' ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-dim)`}>
					{t(toolCapabilityHintI18nKey(capability), { defaultValue: '' })}
				</p>
			) : null}
			<label className="flex max-w-md flex-col gap-1 text-xs text-(--desktop-text-muted)">
				{t('ewaCompanionAdmin.toolsSearchLabel')}
				<input
					className={`${DESKTOP_INTERACTIVE.btnRounded} bg-black/30 px-3 py-1.5 text-sm text-(--desktop-text-primary)`}
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					placeholder={t('ewaCompanionAdmin.toolsSearchPlaceholder')}
				/>
			</label>
			{filtered.length === 0 ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
					{t('ewaCompanionAdmin.toolsSearchEmpty')}
				</p>
			) : (
				<div className="space-y-8">
					{grouped.map(({ cap, items }) => (
						<section key={cap}>
							{capability === 'all' ? (
								<header className="mb-3 border-b border-white/10 pb-2">
									<h3 className="text-base font-medium text-white">
										{t(toolCapabilityI18nKey(cap), { defaultValue: cap })}
									</h3>
									<p
										className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 text-(--desktop-text-dim)`}
									>
										{t(toolCapabilityHintI18nKey(cap), { defaultValue: '' })}
									</p>
								</header>
							) : null}
							<ToolsTableBody tools={items} />
						</section>
					))}
				</div>
			)}
		</div>
	);
}
