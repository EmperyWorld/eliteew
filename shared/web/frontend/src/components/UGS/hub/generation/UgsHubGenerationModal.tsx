/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Form-first quick-launch generation modal for UGS Hub — prompt primary,
 * advanced JSON/priority/type under progressive disclosure.
 *
 * Invariants:
 * - Submit keeps `data-testid="ugs-hub-generation-submit"` and SSE submit path.
 * - JSON editor keeps id `ugs-generate-payload` for compatibility.
 * - Footer is Cancel + Submit only (no default type_key line).
 *
 * Related:
 * - ugsHubGenerationForm.ts, ugsHubDefaultPayload.ts, components/UGSHub.tsx
 */

import {
	ArrowPathIcon,
	SparklesIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { JsonObject } from '@/types/common';
import type { GenerationType } from '../../../../hooks/api/useUgsDashboard';
import { useEmbeddedPortaledModalZIndex } from '../../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import { humanizeUgsTypeKey as humanizeTypeKey } from '../../../../utils/ugsHumanizeTypeKey';
import { ugsProviderDisplayLabel } from '../../../../utils/ugsProviderDisplayLabel';
import { ugsHubCategoryLabel } from '../ugsHubTaskListMeta';
import {
	UgsHubModalFrame,
	ugsHubHeaderBtnClasses,
	ugsHubMetaBadgeClasses,
	ugsHubModalFieldClasses,
	ugsHubModalSubmitBtnClasses,
	ugsHubModalTextareaClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '../ugsHubSharedUi';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import { cn } from '../utils/ugsHubFormatting';
import { parseJSONSafely, stringifyJson } from '../results/ugsHubResultParsing';
import {
	generationTypeSupportsWebSearch,
	getGenerationPrompt,
	setGenerationPrompt,
} from './ugsHubGenerationForm';

export const UgsHubGenerationModal: React.FC<{
	open: boolean;
	type: GenerationType | null;
	/** Публичная подпись канала (display_label / fallback), без сырого имени сервиса */
	providerChannelLabel?: string | null;
	inputData: JsonObject;
	onClose: () => void;
	onSubmit: (
		typeKey: string,
		payload: JsonObject,
		priority?: number
	) => Promise<void>;
	generatingKey: string | null;
}> = React.memo(
	({
		open,
		type,
		providerChannelLabel,
		inputData,
		onClose,
		onSubmit,
		generatingKey,
	}) => {
		const { t } = useTranslation('ugsHub');
		const theme = useUgsHubShellTheme();
		const embeddedModalZ = useEmbeddedPortaledModalZIndex();
		const [localPayload, setLocalPayload] = useState<JsonObject>(inputData);
		const [priority, setPriority] = useState<number>(5);
		const btn = ugsHubHeaderBtnClasses(theme);
		const fieldClass = ugsHubModalFieldClasses(theme);
		const textareaClass = ugsHubModalTextareaClasses(theme);
		const useWebSearch = localPayload.use_web_search === true;
		const showWebSearch = generationTypeSupportsWebSearch(type, localPayload);
		const promptValue = getGenerationPrompt(localPayload);

		useEffect(() => {
			setLocalPayload(inputData);
		}, [inputData]);

		if (!open || !type) {
			return null;
		}

		const handleJsonChange = (value: string) => {
			const parsed = parseJSONSafely(value);
			setLocalPayload(parsed || {});
		};

		const handlePromptChange = (value: string) => {
			setLocalPayload((prev) => setGenerationPrompt(prev, value));
		};

		const handleWebSearchChange = (checked: boolean) => {
			setLocalPayload((prev) => ({
				...prev,
				use_web_search: checked,
			}));
		};

		return (
			<UgsHubModalFrame
				backdropZ={embeddedModalZ.backdrop}
				contentZ={embeddedModalZ.content}
				onClose={onClose}
				maxWidthClass="max-w-[96vw] lg:max-w-3xl"
				maxHeightClass="max-h-[90vh]"
				bodyClassName="p-0"
				header={
					<>
						<div className="flex items-center justify-between gap-4">
							<div className="flex min-w-0 flex-col gap-1">
								<span
									className={cn(
										'text-xs uppercase tracking-[0.3em]',
										ugsHubTextMuted(theme)
									)}
								>
									{t('generation.eyebrow')}
								</span>
								<h2
									className={cn(
										'text-xl font-semibold',
										ugsHubTextPrimary(theme)
									)}
								>
									{type.display_name || humanizeTypeKey(type.type_key)}
								</h2>
								<p className={cn('text-sm', ugsHubTextSecondary(theme))}>
									{type.description || t('generation.fallbackDescription')}
								</p>
							</div>
							<button
								type="button"
								onClick={onClose}
								aria-label={t('generation.closeAria')}
								className={cn(btn, 'p-2')}
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{type.category ? (
								<span className={ugsHubMetaBadgeClasses(theme)}>
									{t('generation.categoryBadge', {
										label: ugsHubCategoryLabel(t, type.category),
									})}
								</span>
							) : null}
							{type.provider ? (
								<span className={ugsHubMetaBadgeClasses(theme)}>
									{t('generation.channelBadge', {
										label:
											providerChannelLabel?.trim() ||
											ugsProviderDisplayLabel(null, undefined, type.provider),
									})}
								</span>
							) : null}
							{type.estimated_time ? (
								<span className={ugsHubMetaBadgeClasses(theme)}>
									{t('generation.etaBadge', { seconds: type.estimated_time })}
								</span>
							) : null}
							{type.cost_credits != null && Number(type.cost_credits) > 0 ? (
								<span className={ugsHubMetaBadgeClasses(theme)}>
									{t('generation.energyBadge', {
										credits: type.cost_credits,
									})}
								</span>
							) : null}
						</div>
					</>
				}
				footer={
					<div className="flex flex-wrap items-center justify-end gap-3">
						<button type="button" onClick={onClose} className={btn}>
							{t('generation.cancel')}
						</button>
						<button
							type="button"
							data-testid="ugs-hub-generation-submit"
							onClick={() => onSubmit(type.type_key, localPayload, priority)}
							disabled={generatingKey === type.type_key}
							className={cn(
								generatingKey === type.type_key
									? cn(btn, 'cursor-progress opacity-80')
									: ugsHubModalSubmitBtnClasses(theme)
							)}
						>
							{generatingKey === type.type_key ? (
								<ArrowPathIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" />
							) : (
								<SparklesIcon className="h-4 w-4" />
							)}
							{t('generation.submit')}
						</button>
					</div>
				}
			>
				<div className="grid max-h-[60vh] min-h-48 gap-6 overflow-x-hidden overflow-y-auto p-6">
					<div className="space-y-4">
						<label
							htmlFor="ugs-generate-prompt"
							className="flex flex-col gap-2"
						>
							<span
								className={cn(
									'text-sm font-medium',
									ugsHubTextSecondary(theme)
								)}
							>
								{t('generation.promptLabel')}
							</span>
							<textarea
								id="ugs-generate-prompt"
								name="ugs-generate-prompt"
								data-testid="ugs-hub-generation-prompt"
								aria-label={t('generation.promptAria')}
								value={promptValue}
								onChange={(event) => handlePromptChange(event.target.value)}
								rows={8}
								className={textareaClass}
							/>
						</label>

						{showWebSearch ? (
							<label
								className={cn(
									ugsHubPanelClasses(theme),
									'flex items-start gap-3 p-3'
								)}
							>
								<input
									type="checkbox"
									checked={useWebSearch}
									onChange={(event) =>
										handleWebSearchChange(event.target.checked)
									}
									className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20 text-cyan-400 focus:ring-cyan-400/30"
								/>
								<span className="flex flex-col gap-1">
									<span
										className={cn(
											'text-sm font-medium',
											ugsHubTextPrimary(theme)
										)}
									>
										{t('generation.webSearchLabel')}
									</span>
									<span className={cn('text-xs', ugsHubTextMuted(theme))}>
										{t('generation.webSearchHint')}
									</span>
								</span>
							</label>
						) : null}

						<details className="group rounded-xl border border-white/10 open:border-white/20">
							<summary
								className={cn(
									'cursor-pointer list-none px-3 py-2 text-sm font-medium',
									ugsHubTextSecondary(theme),
									'[&::-webkit-details-marker]:hidden'
								)}
							>
								{t('generation.advancedSummary')}
							</summary>
							<div className="space-y-4 border-t border-white/10 p-3">
								<label
									htmlFor="ugs-generate-payload"
									className="flex flex-col gap-2"
								>
									<span
										className={cn(
											'text-sm font-medium',
											ugsHubTextSecondary(theme)
										)}
									>
										{t('generation.jsonLabel')}
									</span>
									<textarea
										id="ugs-generate-payload"
										name="ugs-generate-payload"
										aria-label={t('generation.jsonAria')}
										value={stringifyJson(localPayload)}
										onChange={(event) => handleJsonChange(event.target.value)}
										rows={10}
										className={textareaClass}
									/>
								</label>
								<p className={cn('text-xs', ugsHubTextMuted(theme))}>
									{t('generation.jsonHint')}
								</p>

								<label
									htmlFor="ugs-generate-priority"
									className="flex flex-col gap-2"
								>
									<span
										className={cn(
											'text-sm font-medium',
											ugsHubTextSecondary(theme)
										)}
									>
										{t('generation.priorityLabel')}
									</span>
									<input
										id="ugs-generate-priority"
										name="ugs-generate-priority"
										type="number"
										min={1}
										max={10}
										aria-label={t('generation.priorityAria')}
										value={priority}
										onChange={(event) =>
											setPriority(Number(event.target.value))
										}
										className={fieldClass}
									/>
								</label>

								<div className={cn(ugsHubPanelClasses(theme), 'p-4 text-sm')}>
									<p className={cn('font-medium', ugsHubTextPrimary(theme))}>
										{t('generation.priorityHintTitle')}
									</p>
									<p className={cn('mt-2 text-xs', ugsHubTextMuted(theme))}>
										{t('generation.priorityHintBody')}
									</p>
								</div>

								<div className="flex flex-col gap-1">
									<span
										className={cn(
											'text-sm font-medium',
											ugsHubTextSecondary(theme)
										)}
									>
										{t('generation.typeKeyLabel')}
									</span>
									<code
										className={cn(
											'rounded-lg px-3 py-2 font-mono text-xs',
											ugsHubPanelClasses(theme),
											ugsHubTextMuted(theme)
										)}
									>
										{type.type_key}
									</code>
								</div>
							</div>
						</details>
					</div>
				</div>
			</UgsHubModalFrame>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.open === nextProps.open &&
			prevProps.type?.type_key === nextProps.type?.type_key &&
			prevProps.providerChannelLabel === nextProps.providerChannelLabel &&
			prevProps.generatingKey === nextProps.generatingKey &&
			JSON.stringify(prevProps.inputData) ===
				JSON.stringify(nextProps.inputData)
		);
	}
);

UgsHubGenerationModal.displayName = 'UgsHubGenerationModal';
