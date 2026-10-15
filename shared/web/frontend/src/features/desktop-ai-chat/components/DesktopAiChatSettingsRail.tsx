/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat settings rail: compact basic toggles (one wrap row) and advanced project/vault/ensemble block.
 *
 * Invariants:
 * - Primary project picker label never shows raw project id slices.
 * - Ensemble routing dropdown lives in DesktopAiChatEnsembleControls, not basic section.
 * - Voice + tools toggles share one wrap row under `data-ai-chat-guide="voice-settings"`.
 *
 * Related:
 * - components/DesktopAiChatMainHeader.tsx, hooks/useDesktopAiChatEnsemble.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type {
	DesktopAiChatItem,
	DesktopAiProjectRow,
} from '../api/desktopChatClient';
import { DesktopAiChatSettingToggle } from '../DesktopAiChatSettingToggle';
import type { DesktopEnsembleRoutingMode } from '../desktopAiHeroes';
import { DESKTOP_AI_CHAT_PROJECT_MENU_ID } from '../desktopAiChatDomIds';
import {
	readSettingsAdvancedOpen,
	writeSettingsAdvancedOpen,
} from '../utils/desktopAiChatFormatters';
import { DESKTOP_TYPOGRAPHY } from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAiChatEnsembleControls } from './DesktopAiChatEnsembleControls';

export type DesktopAiChatSettingsRailProps = {
	activeChat: DesktopAiChatItem | null;
	settings: Record<string, unknown>;
	useProjectRag: boolean;
	setUseProjectRag: (v: boolean) => void;
	projectId: string;
	projectMenuRef: React.RefObject<HTMLDivElement | null>;
	projectMenuOpen: boolean;
	setProjectMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
	projectQuery: string;
	setProjectQuery: (v: string) => void;
	projectSearchInputRef: React.RefObject<HTMLInputElement | null>;
	filteredProjects: DesktopAiProjectRow[];
	selectedProjectName: string | null;
	onApplyProjectBinding: (overrideProjectId?: string) => void | Promise<void>;
	useTools: boolean;
	useWebSearch: boolean;
	voiceIn: boolean;
	voiceOut: boolean;
	voiceAllowed: boolean;
	setPanelPref: (patch: {
		useTools?: boolean;
		useWebSearch?: boolean;
		voiceIn?: boolean;
		voiceOut?: boolean;
	}) => void;
	toolsHint: string;
	isEnsembleActive: boolean;
	ensembleRoutingMenuRef: React.RefObject<HTMLDivElement | null>;
	ensembleRoutingMenuOpen: boolean;
	ensembleRoutingMode: DesktopEnsembleRoutingMode;
	ensembleRoutingModeLabel: string;
	ensembleRoutingBusy: boolean;
	onEnsembleRoutingToggle: () => void;
	onEnsembleRoutingSelect: (mode: DesktopEnsembleRoutingMode) => void;
	onCloseEnsembleRoutingMenu: () => void;
	canPatchSettings: boolean;
	canManageProject: boolean;
	t: TFunction<'desktopAiChat'>;
	lucideStroke: number;
};

function projectPickerLabel(
	selectedProjectName: string | null,
	projectId: string,
	t: TFunction<'desktopAiChat'>
): string {
	if (selectedProjectName) {
		return selectedProjectName;
	}
	if (projectId.trim()) {
		return t('contextProjectBound');
	}
	return t('projectPlaceholder');
}

export function DesktopAiChatSettingsRail({
	activeChat,
	settings,
	useProjectRag,
	setUseProjectRag,
	projectId,
	projectMenuRef,
	projectMenuOpen,
	setProjectMenuOpen,
	projectQuery,
	setProjectQuery,
	projectSearchInputRef,
	filteredProjects,
	selectedProjectName,
	onApplyProjectBinding,
	useTools,
	useWebSearch,
	voiceIn,
	voiceOut,
	voiceAllowed,
	setPanelPref,
	toolsHint,
	isEnsembleActive,
	ensembleRoutingMenuRef,
	ensembleRoutingMenuOpen,
	ensembleRoutingMode,
	ensembleRoutingModeLabel,
	ensembleRoutingBusy,
	onEnsembleRoutingToggle,
	onEnsembleRoutingSelect,
	onCloseEnsembleRoutingMenu,
	canPatchSettings,
	canManageProject,
	t,
	lucideStroke,
}: DesktopAiChatSettingsRailProps) {
	const [advancedOpen, setAdvancedOpen] = React.useState(
		readSettingsAdvancedOpen
	);
	const vaultIneligible = Boolean(
		activeChat?.project_id && !activeChat?.vault_rag_eligible
	);

	const handleAdvancedToggle = (open: boolean) => {
		setAdvancedOpen(open);
		writeSettingsAdvancedOpen(open);
	};

	return (
		<section
			data-ai-chat-guide="settings-panel"
			aria-labelledby="desktop-ai-chat-settings-basic"
			className="flex flex-col gap-1"
		>
			<h3
				id="desktop-ai-chat-settings-basic"
				className={cn(
					'px-0.5 font-semibold uppercase tracking-wide text-(--desktop-text-muted)',
					DESKTOP_TYPOGRAPHY.micro
				)}
			>
				{t('settingsBasicTitle')}
			</h3>
			<div
				className="flex flex-wrap items-center gap-x-1.5 gap-y-1"
				data-ai-chat-guide="voice-settings"
			>
				<DesktopAiChatSettingToggle
					inputId="desktop-ai-chat-voice-in"
					checked={voiceIn}
					onChange={(v) => setPanelPref({ voiceIn: v })}
					disabled={!voiceAllowed}
					title={
						voiceAllowed ? t('voiceInTitle') : t('voiceDisabledServerHint')
					}
				>
					{t('voiceInLabel')}
				</DesktopAiChatSettingToggle>
				<DesktopAiChatSettingToggle
					inputId="desktop-ai-chat-voice-out"
					checked={voiceOut}
					onChange={(v) => setPanelPref({ voiceOut: v })}
					disabled={!voiceAllowed || isEnsembleActive}
					title={
						!voiceAllowed
							? t('voiceDisabledServerHint')
							: isEnsembleActive
								? t('voiceOutDisabledEnsemble')
								: t('voiceOutTitle')
					}
				>
					{t('voiceOutLabel')}
				</DesktopAiChatSettingToggle>
				<DesktopAiChatSettingToggle
					inputId="desktop-ai-chat-smart-tools"
					checked={useTools}
					onChange={(v) => setPanelPref({ useTools: v })}
					disabled={isEnsembleActive}
					title={isEnsembleActive ? t('smartToolsDisabledEnsemble') : toolsHint}
				>
					{t('smartToolsLabel')}
				</DesktopAiChatSettingToggle>
				<DesktopAiChatSettingToggle
					inputId="desktop-ai-chat-web-search"
					checked={useWebSearch}
					onChange={(v) => setPanelPref({ useWebSearch: v })}
					disabled={
						settings.tools_web_search_enabled !== true ||
						(!isEnsembleActive && !useTools)
					}
					title={
						settings.tools_web_search_enabled !== true
							? t('webSearchDisabledAdmin')
							: !isEnsembleActive && !useTools
								? t('webSearchNeedsTools')
								: t('webSearchTitle')
					}
				>
					{t('webSearchLabel')}
				</DesktopAiChatSettingToggle>
				{useTools && !isEnsembleActive ? (
					<p
						className={cn(
							'w-full basis-full px-0.5 leading-snug text-(--desktop-text-muted)',
							DESKTOP_TYPOGRAPHY.micro,
							'font-normal'
						)}
					>
						{t('soloSmartToolsEnergyNote')}
					</p>
				) : null}
			</div>
			<details
				open={advancedOpen && canManageProject}
				onToggle={(e) => {
					if (!canManageProject) return;
					handleAdvancedToggle(e.currentTarget.open);
				}}
				className="rounded-md border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.18)_100%,transparent)] px-1.5 py-0.5"
			>
				<summary
					className={cn(
						'cursor-pointer select-none font-semibold uppercase tracking-wide text-(--desktop-text-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] rounded min-h-7 py-0.5',
						DESKTOP_TYPOGRAPHY.micro,
						!canManageProject && 'opacity-50 cursor-not-allowed list-none'
					)}
				>
					{t('settingsAdvancedTitle')}
				</summary>
				{canManageProject ? (
					<div className="mt-1 flex flex-col gap-1 pb-0.5">
						<div
							className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0"
							ref={projectMenuRef}
						>
							<div className="relative flex-1 min-w-[140px] max-w-xs">
								<button
									type="button"
									id="desktop-ai-chat-project-picker"
									aria-expanded={projectMenuOpen}
									aria-controls={DESKTOP_AI_CHAT_PROJECT_MENU_ID}
									onClick={() => {
										onCloseEnsembleRoutingMenu();
										setProjectMenuOpen((o) => !o);
										setProjectQuery('');
									}}
									className="w-full min-w-0 text-left rounded-lg border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] px-2 py-1 text-xs text-(--desktop-text-secondary) antialiased flex items-center justify-between gap-1"
								>
									<span className="truncate">
										{projectPickerLabel(selectedProjectName, projectId, t)}
									</span>
									<ChevronDownIcon
										className="h-3.5 w-3.5 shrink-0 opacity-70"
										strokeWidth={lucideStroke}
									/>
								</button>
								{projectMenuOpen ? (
									<fieldset
										id={DESKTOP_AI_CHAT_PROJECT_MENU_ID}
										className="absolute left-0 right-0 top-full z-50 mt-1 m-0 min-w-0 rounded-lg border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,var(--glass-bg-strong)_95%,#0a0520)] shadow-lg max-h-56 flex flex-col"
										aria-label={t('projectPlaceholder')}
									>
										<input
											ref={projectSearchInputRef}
											className="m-1 rounded-md border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.34)_100%,transparent)] px-2 py-1 text-xs"
											placeholder={t('projectSearchPh')}
											aria-label={t('projectSearchPh')}
											value={projectQuery}
											onChange={(e) => setProjectQuery(e.target.value)}
										/>
										{filteredProjects.length ? (
											<div
												className="overflow-y-auto px-1 pb-1 space-y-0.5"
												role="listbox"
												aria-label={t('projectPlaceholder')}
											>
												{filteredProjects.map((p) => {
													const isSel = p.id === projectId;
													const optClass = [
														'w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]',
														isSel
															? 'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] text-(--desktop-text-primary)'
															: 'text-(--desktop-text-secondary)',
													].join(' ');
													return (
														<button
															key={p.id}
															type="button"
															role="option"
															aria-selected={isSel}
															className={optClass}
															onClick={() => {
																setProjectMenuOpen(false);
																void onApplyProjectBinding(p.id);
															}}
														>
															<span className="block font-medium truncate">
																{p.name}
															</span>
														</button>
													);
												})}
											</div>
										) : (
											<p
												className={cn(
													'px-2 py-2 text-(--desktop-text-muted)',
													DESKTOP_TYPOGRAPHY.shellMeta10
												)}
											>
												{t('projectsEmpty')}
											</p>
										)}
									</fieldset>
								) : null}
							</div>
							{projectId.trim() && selectedProjectName ? (
								<span
									className={cn(
										'inline-flex max-w-40 items-center gap-1 rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-2 py-0.5',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									<span className="truncate">{selectedProjectName}</span>
									<button
										type="button"
										className="shrink-0 opacity-80 hover:opacity-100"
										onClick={() => void onApplyProjectBinding('')}
										aria-label={t('projectResetAria')}
									>
										×
									</button>
								</span>
							) : null}
						</div>
						{activeChat?.vault_rag_eligible ? (
							<DesktopAiChatSettingToggle
								inputId="desktop-ai-chat-vault-rag"
								checked={useProjectRag}
								onChange={setUseProjectRag}
								onBlur={() => void onApplyProjectBinding()}
								title={t('vaultRagTitle')}
							>
								{t('vaultRagLabel')}
							</DesktopAiChatSettingToggle>
						) : null}
						{vaultIneligible ? (
							<p
								className={cn(
									'px-0.5 leading-snug text-(--desktop-text-muted)',
									DESKTOP_TYPOGRAPHY.micro,
									'font-normal'
								)}
							>
								{t('vaultRagNotEligibleHint')}
							</p>
						) : null}
						{isEnsembleActive && canPatchSettings ? (
							<DesktopAiChatEnsembleControls
								routingMenuRef={ensembleRoutingMenuRef}
								menuOpen={ensembleRoutingMenuOpen}
								routingMode={ensembleRoutingMode}
								routingModeLabel={ensembleRoutingModeLabel}
								routingBusy={ensembleRoutingBusy}
								onToggle={onEnsembleRoutingToggle}
								onSelectMode={onEnsembleRoutingSelect}
								t={t}
								lucideStroke={lucideStroke}
							/>
						) : null}
						{isEnsembleActive && ensembleRoutingMode === 'semi' ? (
							<p
								className={cn(
									'px-0.5 leading-snug text-(--desktop-text-muted)',
									DESKTOP_TYPOGRAPHY.micro,
									'font-normal'
								)}
							>
								{t('ensembleRoutingHint')}
							</p>
						) : null}
					</div>
				) : null}
			</details>
		</section>
	);
}
