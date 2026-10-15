/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site Studio Desktop `ai` tab panel.
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
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	ArrowPathIcon,
	MicrophoneIcon,
	PaperAirplaneIcon,
	SparklesIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { WORKSPACE_SCROLL_AREA_CLASS } from './userSiteStudioAppModel';
import type { UserSiteStudioTabVm } from './useUserSiteStudioAppController';

export function UserSiteStudioAiTab({ vm }: { vm: UserSiteStudioTabVm }) {
	const { t } = useTranslation('siteStudio');
	const {
		instance,
		catalog,
		assistantInput,
		setAssistantInput,
		busyKeys,
		aiProgress,
		siteStudioInsetTextareaClassName,
		toggleVoiceCapture,
		handleGenerateBrief,
		handleAssistantSend,
		handleGenerateContentPack,
		handleGenerateSeo,
		renderPanelError,
		renderWorkspaceGuidedCockpit,
		renderBlueprintSummary,
		isAssistantRecording,
		assistantMessages,
	} = vm;

	if (!instance) {
		return null;
	}

	return (
		<div
			id="site-studio-panel-ai"
			tabIndex={-1}
			className={WORKSPACE_SCROLL_AREA_CLASS}
		>
			{renderWorkspaceGuidedCockpit()}
			<div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
				<DesktopAppPanel className="flex min-h-0 flex-col gap-4 overflow-hidden p-4">
					<div className="space-y-2">
						<DesktopAppSectionLabel>
							{t('assistant.panelTitle')}
						</DesktopAppSectionLabel>
						<p className="text-sm leading-6 text-(--desktop-text-secondary)">
							{t('assistant.panelDescription')}
						</p>
					</div>

					<div className="min-h-65 flex-1 space-y-3 overflow-y-auto pr-1">
						{assistantMessages.length ? (
							assistantMessages.map((message) => (
								<DesktopAppSurface
									key={message.id}
									variant="soft"
									padding="sm"
									className={
										message.role === 'assistant'
											? 'border-[rgb(var(--desktop-accent-rgb))]/20'
											: ''
									}
								>
									<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
										{message.role === 'assistant'
											? t('assistant.roleAssistant')
											: t('assistant.roleUser')}
									</div>
									<div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-(--desktop-text-primary)">
										{message.content}
									</div>
								</DesktopAppSurface>
							))
						) : (
							<DesktopAppSurface
								variant="soft"
								padding="sm"
								className="text-sm text-(--desktop-text-secondary)"
							>
								{t('assistant.emptyHistory')}
							</DesktopAppSurface>
						)}
					</div>

					<div className="grid gap-3">
						<Textarea
							value={assistantInput}
							onChange={(event) => setAssistantInput(event.target.value)}
							rows={4}
							className={siteStudioInsetTextareaClassName}
							placeholder={t('assistant.inputPlaceholder')}
						/>
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={busyKeys.has('assistant') || !assistantInput.trim()}
								onClick={() => handleAssistantSend().catch(() => undefined)}
							>
								{busyKeys.has('assistant') ? (
									<ArrowPathIcon className="h-4 w-4 animate-spin" />
								) : (
									<PaperAirplaneIcon className="h-4 w-4" />
								)}
								{t('assistant.sendButton')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant={isAssistantRecording ? 'danger' : 'ghost'}
								disabled={busyKeys.has('voice:assistant')}
								onClick={() =>
									toggleVoiceCapture('assistant').catch(() => undefined)
								}
							>
								{isAssistantRecording ? (
									<SpeakerXMarkIcon className="h-4 w-4" />
								) : (
									<MicrophoneIcon className="h-4 w-4" />
								)}
								{isAssistantRecording
									? t('setup.voiceStop')
									: t('setup.voiceStart')}
							</DesktopAppButton>
						</div>
						{renderPanelError('ai')}
					</div>
				</DesktopAppPanel>
				<div className="grid content-start gap-4">
					<DesktopAppPanel className="space-y-4 p-4">
						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('assistant.quickActionsTitle')}
							</DesktopAppSectionLabel>
							<p className="text-sm leading-6 text-(--desktop-text-secondary)">
								{t('assistant.quickActionsDescription')}
							</p>
						</div>

						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="neutral"
								disabled={busyKeys.has('brief-wizard')}
								onClick={() => handleGenerateBrief().catch(() => undefined)}
							>
								<SparklesIcon className="h-4 w-4" />
								{t('assistant.refreshBlueprint')}
							</DesktopAppButton>
							{(catalog?.contentPacks ?? []).map((pack) => (
								<DesktopAppButton
									key={pack.key}
									type="button"
									variant="neutral"
									disabled={busyKeys.has(`content:${pack.key}`)}
									onClick={() =>
										handleGenerateContentPack(pack.key).catch(() => undefined)
									}
								>
									{busyKeys.has(`content:${pack.key}`) ? (
										<ArrowPathIcon className="h-4 w-4 animate-spin" />
									) : (
										<SparklesIcon className="h-4 w-4" />
									)}
									{pack.title}
								</DesktopAppButton>
							))}
							<DesktopAppButton
								type="button"
								variant="neutral"
								disabled={busyKeys.has('seo-pack')}
								onClick={() => handleGenerateSeo().catch(() => undefined)}
							>
								{busyKeys.has('seo-pack') ? (
									<ArrowPathIcon className="h-4 w-4 animate-spin" />
								) : (
									<SparklesIcon className="h-4 w-4" />
								)}
								{t('assistant.generateSeo')}
							</DesktopAppButton>
						</div>
						{aiProgress ? (
							<DesktopAppSurface
								variant="soft"
								padding="sm"
								className="text-sm text-(--desktop-text-secondary)"
								aria-live="polite"
							>
								{aiProgress}
							</DesktopAppSurface>
						) : null}
					</DesktopAppPanel>

					<DesktopAppPanel className="space-y-4 p-4">
						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('assistant.blueprintTitle')}
							</DesktopAppSectionLabel>
							<p className="text-sm leading-6 text-(--desktop-text-secondary)">
								{t('assistant.blueprintDescription')}
							</p>
						</div>
						{renderBlueprintSummary}
					</DesktopAppPanel>
				</div>
			</div>
		</div>
	);
}
