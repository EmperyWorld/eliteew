/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Prompts tab — list/edit ewa_companion_prompt_block bodies (platform prose).
 *
 * Invariants:
 * - Save requires write gate; computed tool catalog is not edited here.
 *
 * Related:
 * - src/features/ewa/admin/ewaCompanionAdminApi.ts
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE } from '@/pages/Desktop/constants';
import {
	fetchEwaCompanionPromptBlocks,
	updateEwaCompanionPromptBlock,
	type EwaCompanionPromptBlock,
} from './ewaCompanionAdminApi';
import { EwaCompanionAdminCatalogFrame } from './ewaCompanionAdminCatalogFrame';

export function EwaCompanionPromptsTab({
	writeEnabled,
}: {
	writeEnabled: boolean;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const qc = useQueryClient();
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [draft, setDraft] = useState('');
	const [categoryFilter, setCategoryFilter] = useState('all');

	const query = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'prompt-blocks'],
		queryFn: fetchEwaCompanionPromptBlocks,
		retry: false,
	});

	const blocks = query.data?.blocks ?? [];
	const categories = useMemo(() => {
		const set = new Set(blocks.map((b) => b.category || 'system'));
		return ['all', ...Array.from(set).sort()];
	}, [blocks]);

	const filtered = useMemo(() => {
		if (categoryFilter === 'all') return blocks;
		return blocks.filter((b) => (b.category || 'system') === categoryFilter);
	}, [blocks, categoryFilter]);

	const selected: EwaCompanionPromptBlock | undefined = blocks.find(
		(b) => b.block_key === selectedKey
	);

	const selectBlock = (block: EwaCompanionPromptBlock) => {
		setSelectedKey(block.block_key);
		setDraft(block.body_text);
	};

	const saveMut = useMutation({
		mutationFn: () => updateEwaCompanionPromptBlock(selectedKey ?? '', draft),
		onSuccess: async () => {
			await qc.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion', 'prompt-blocks'],
			});
		},
	});

	return (
		<EwaCompanionAdminCatalogFrame
			isLoading={query.isLoading}
			error={query.error}
			empty={!query.isLoading && !query.error && blocks.length === 0}
			loadingLabel={t('ewaCompanionAdmin.loadingPrompts')}
			emptyLabel={t('ewaCompanionAdmin.emptyPrompts')}
		>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<label className="text-xs text-(--desktop-text-muted)">
					{t('ewaCompanionAdmin.promptCategory')}
					<select
						className="ml-2 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-(--desktop-text-primary)"
						value={categoryFilter}
						onChange={(e) => setCategoryFilter(e.target.value)}
					>
						{categories.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
				{!writeEnabled ? (
					<p className="text-xs text-amber-200">
						{t('ewaCompanionAdmin.promptsWriteOff')}
					</p>
				) : null}
			</div>
			<div className="grid min-h-[420px] gap-3 lg:grid-cols-[280px_1fr]">
				<div className="overflow-auto rounded-lg border border-white/10">
					<ul className="divide-y divide-white/5 text-sm">
						{filtered.map((b) => (
							<li key={b.block_key}>
								<button
									type="button"
									className={`w-full px-3 py-2 text-left hover:bg-white/[0.06] ${
										selectedKey === b.block_key
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.2)]'
											: ''
									}`}
									onClick={() => selectBlock(b)}
								>
									<div className="font-mono text-xs text-(--desktop-text-primary)">
										{b.block_key}
									</div>
									<div className="text-[11px] text-(--desktop-text-dim)">
										{b.category} · {b.source}
									</div>
								</button>
							</li>
						))}
					</ul>
				</div>
				<div className="flex min-h-0 flex-col gap-2 rounded-lg border border-white/10 p-3">
					{selected ? (
						<>
							<p className="text-xs text-(--desktop-text-muted)">
								{selected.description}
							</p>
							<textarea
								className="min-h-[280px] flex-1 rounded border border-white/10 bg-black/40 p-3 font-mono text-xs text-(--desktop-text-primary)"
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								disabled={!writeEnabled}
							/>
							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled={!writeEnabled || saveMut.isPending}
									className={`${DESKTOP_INTERACTIVE.btnRounded} bg-[rgb(var(--desktop-accent-rgb)/0.4)] px-3 py-1.5 text-sm text-white disabled:opacity-40`}
									onClick={() => saveMut.mutate()}
								>
									{t('ewaCompanionAdmin.savePrompt')}
								</button>
								{saveMut.isError ? (
									<span className="text-xs text-red-300">
										{t('ewaCompanionAdmin.savePromptFailed')}
									</span>
								) : null}
								{saveMut.isSuccess ? (
									<span className="text-xs text-emerald-300">
										{t('ewaCompanionAdmin.savePromptOk')}
									</span>
								) : null}
							</div>
						</>
					) : (
						<p className="text-sm text-(--desktop-text-muted)">
							{t('ewaCompanionAdmin.selectPrompt')}
						</p>
					)}
				</div>
			</div>
		</EwaCompanionAdminCatalogFrame>
	);
}
