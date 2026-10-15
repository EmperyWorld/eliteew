/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site Studio Desktop `setup` tab panel.
 *
 * Invariants:
 * - Presentation-only; mutations go through controller handlers on `vm`.
 *
 * Related:
 * - features/site-studio/desktop/UserSiteStudioAppView.tsx
 */
import { Textarea } from '@components/atoms/Textarea';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppPanel,
	DESKTOP_APP_STYLE_CONTRACT,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { SiteStudioChecklist } from './components/SiteStudioChecklist';
import { SiteStudioDangerZone } from './components/SiteStudioDangerZone';
import { SiteStudioRuntimePanel } from './components/SiteStudioRuntimePanel';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CpuChipIcon,
	MicrophoneIcon,
	SparklesIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { WORKSPACE_SCROLL_AREA_CLASS } from './userSiteStudioAppModel';
import type { UserSiteStudioTabVm } from './useUserSiteStudioAppController';

export function UserSiteStudioSetupTab({ vm }: { vm: UserSiteStudioTabVm }) {
	const { t } = useTranslation('siteStudio');
	const {
		instance,
		health,
		setActiveTab,
		form,
		setForm,
		busyKeys,
		setDeleteConfirmOpen,
		setDeleteConfirmationValue,
		siteStudioInsetTextareaClassName,
		clearNotice,
		adminShellReady,
		toggleVoiceCapture,
		handleSaveMetadata,
		handleGenerateBrief,
		handleRunAction,
		handleCopy,
		userJourney,
		handleJourneyAction,
		renderPanelError,
		renderWorkspaceGuidedCockpit,
		safeDrafts,
		renderBlueprintSummary,
		isBriefRecording,
	} = vm;

	if (!instance) {
		return null;
	}

	return (
		<div
			id="site-studio-panel-setup"
			tabIndex={-1}
			className={WORKSPACE_SCROLL_AREA_CLASS}
		>
			{renderWorkspaceGuidedCockpit()}
			<div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[0.95fr_1.05fr]">
				<div className="grid content-start gap-4">
					{userJourney ? (
						<div data-ss-guide="checklist">
							<SiteStudioChecklist
								journey={userJourney}
								onAction={handleJourneyAction}
							/>
						</div>
					) : null}
					<div data-ss-guide="runtime">
						<SiteStudioRuntimePanel
							instance={instance}
							health={health}
							drafts={safeDrafts}
							busyKeys={busyKeys}
							canOpenAdminShell={adminShellReady}
							onRunAction={(action) =>
								handleRunAction(action).catch(() => undefined)
							}
							onOpenPublic={() =>
								instance.public_url &&
								window.open(
									instance.public_url,
									'_blank',
									'noopener,noreferrer'
								)
							}
							onOpenAdmin={() => setActiveTab('admin')}
							onCopy={(value, label) =>
								handleCopy(value, label).catch(() => undefined)
							}
						/>
					</div>
					<details className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated)/80 p-3 text-xs text-(--desktop-text-secondary)">
						<summary className="cursor-pointer select-none font-medium text-(--desktop-text-primary)">
							{t('runtime.diagnosticsTitle')}
						</summary>
						<dl className="mt-3 grid gap-2">
							<div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-2 gap-y-1">
								<dt>{t('runtime.diagnosticsTemplate')}</dt>
								<dd className="break-all font-mono text-(--desktop-text-primary)">
									{instance.template_key}
								</dd>
							</div>
							<div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-2 gap-y-1">
								<dt>{t('runtime.diagnosticsLastProvisioned')}</dt>
								<dd className="wrap-break-word text-(--desktop-text-primary)">
									{instance.last_provisioned_at
										? new Date(instance.last_provisioned_at).toLocaleString()
										: '—'}
								</dd>
							</div>
							<div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-2 gap-y-1">
								<dt>{t('runtime.diagnosticsLastError')}</dt>
								<dd className="wrap-break-word text-(--desktop-text-primary)">
									{instance.last_error ?? '—'}
								</dd>
							</div>
						</dl>
					</details>
					{renderPanelError('setup')}
				</div>

				<div className="grid content-start gap-4">
					<DesktopAppPanel className="space-y-4 p-4">
						<div className="space-y-2">
							<h2
								id="site-studio-brand-title"
								className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}
							>
								{t('setup.existingTitle')}
							</h2>
							<p className="text-sm leading-6 text-(--desktop-text-secondary)">
								{t('setup.existingDescription')}
							</p>
						</div>

						<div className="grid gap-3">
							<DesktopAppInput
								value={form.site_title}
								onChange={(event) =>
									setForm((previous) => ({
										...previous,
										site_title: event.target.value,
									}))
								}
								placeholder={t('setup.siteTitlePlaceholder')}
							/>
							<DesktopAppInput
								value={form.site_topic}
								onChange={(event) =>
									setForm((previous) => ({
										...previous,
										site_topic: event.target.value,
									}))
								}
								placeholder={t('setup.topicPlaceholder')}
							/>
							<div className="grid gap-2">
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm text-(--desktop-text-secondary)">
										{t('setup.descriptionLabel')}
									</span>
									<DesktopAppButton
										type="button"
										size="sm"
										variant={isBriefRecording ? 'danger' : 'ghost'}
										disabled={busyKeys.has('voice:brief')}
										onClick={() =>
											toggleVoiceCapture('brief').catch(() => undefined)
										}
									>
										{isBriefRecording ? (
											<SpeakerXMarkIcon className="h-4 w-4" />
										) : (
											<MicrophoneIcon className="h-4 w-4" />
										)}
										{isBriefRecording
											? t('setup.voiceStop')
											: t('setup.voiceStart')}
									</DesktopAppButton>
								</div>
								<Textarea
									value={form.brief}
									onChange={(event) =>
										setForm((previous) => ({
											...previous,
											brief: event.target.value,
										}))
									}
									rows={10}
									className={siteStudioInsetTextareaClassName}
									placeholder={t('setup.descriptionPlaceholder')}
								/>
							</div>
						</div>

						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={busyKeys.has('save-metadata')}
								onClick={() => handleSaveMetadata().catch(() => undefined)}
							>
								{busyKeys.has('save-metadata') ? (
									<ArrowPathIcon className="h-4 w-4 animate-spin" />
								) : (
									<ArrowDownTrayIcon className="h-4 w-4" />
								)}
								{t('setup.saveButton')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								disabled={busyKeys.has('brief-wizard')}
								onClick={() => handleGenerateBrief().catch(() => undefined)}
							>
								{busyKeys.has('brief-wizard') ? (
									<ArrowPathIcon className="h-4 w-4 animate-spin" />
								) : (
									<SparklesIcon className="h-4 w-4" />
								)}
								{t('setup.generateStructureButton')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => setActiveTab('ai')}
							>
								<CpuChipIcon className="h-4 w-4" />
								{t('setup.openAssistantButton')}
							</DesktopAppButton>
						</div>

						{renderBlueprintSummary}
					</DesktopAppPanel>

					<SiteStudioDangerZone
						siteSlug={instance.site_slug}
						disabled={busyKeys.has('delete')}
						onDelete={() => {
							clearNotice();
							setDeleteConfirmationValue('');
							setDeleteConfirmOpen(true);
						}}
					/>
				</div>
			</div>
		</div>
	);
}
