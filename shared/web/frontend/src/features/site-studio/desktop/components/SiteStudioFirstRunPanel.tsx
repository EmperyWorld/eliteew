/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * First-run Site Studio workspace screen for creating or recovering a user site before an instance exists.
 *
 * Invariants:
 * - This component is presentational; create/recover/voice side effects stay in the parent workspace.
 * - Primary copy stays user-facing and avoids runtime/worker/internal engine terms.
 *
 * Related:
 * - features/site-studio/desktop/UserSiteStudioApp.tsx
 * - documentation/product/SITE-STUDIO.md
 */
import { Textarea } from '@components/atoms/Textarea';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	MicrophoneIcon,
	RocketLaunchIcon,
	SparklesIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';

export type SiteStudioFirstRunForm = {
	site_title: string;
	site_topic: string;
	brief: string;
};

interface SiteStudioFirstRunPanelProps {
	form: SiteStudioFirstRunForm;
	busyKeys: Set<string>;
	isBriefRecording: boolean;
	introShellClassName: string;
	textareaClassName: string;
	notice: React.ReactNode;
	setupError: React.ReactNode;
	onFormChange: React.Dispatch<React.SetStateAction<SiteStudioFirstRunForm>>;
	onCreateWorkspace: (provisionAfterCreate: boolean) => void;
	onRecoverExistingInstance: () => void;
	onToggleVoiceCapture: () => void;
}

export const SiteStudioFirstRunPanel: React.FC<
	SiteStudioFirstRunPanelProps
> = ({
	form,
	busyKeys,
	isBriefRecording,
	introShellClassName,
	textareaClassName,
	notice,
	setupError,
	onFormChange,
	onCreateWorkspace,
	onRecoverExistingInstance,
	onToggleVoiceCapture,
}) => {
	const { t } = useTranslation('siteStudio');

	return (
		<DesktopAppContentWrapper appComponent="UserSiteStudio" className="h-full">
			<div className="h-full overflow-y-auto pr-1">
				<div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
					<div className={cn(introShellClassName, 'flex flex-col gap-4 p-5')}>
						<div className="space-y-1.5">
							<DesktopAppSectionLabel>
								{t('setup.firstRun.kicker')}
							</DesktopAppSectionLabel>
							<h1 className={DESKTOP_TYPOGRAPHY.title}>
								{t('setup.firstRun.title')}
							</h1>
							<p className={cn('leading-relaxed', DESKTOP_TYPOGRAPHY.body)}>
								{t('setup.firstRun.description')}
							</p>
						</div>

						{notice}

						<div className="grid gap-4">
							<div className="grid gap-2">
								<label
									htmlFor="site-studio-setup-title"
									className="text-sm text-(--desktop-text-secondary)"
								>
									{t('setup.firstRun.siteTitleLabel')}
								</label>
								<DesktopAppInput
									id="site-studio-setup-title"
									value={form.site_title}
									onChange={(event) =>
										onFormChange((previous) => ({
											...previous,
											site_title: event.target.value,
										}))
									}
									placeholder={t('setup.firstRun.siteTitlePlaceholder')}
								/>
							</div>
							<div className="grid gap-2">
								<label
									htmlFor="site-studio-setup-topic"
									className="text-sm text-(--desktop-text-secondary)"
								>
									{t('setup.firstRun.topicLabel')}
								</label>
								<DesktopAppInput
									id="site-studio-setup-topic"
									value={form.site_topic}
									onChange={(event) =>
										onFormChange((previous) => ({
											...previous,
											site_topic: event.target.value,
										}))
									}
									placeholder={t('setup.firstRun.topicPlaceholder')}
								/>
							</div>
							<div className="grid gap-2">
								<div className="flex items-center justify-between gap-3">
									<label
										htmlFor="site-studio-setup-brief"
										className="text-sm text-(--desktop-text-secondary)"
									>
										{t('setup.firstRun.briefLabel')}
									</label>
									<DesktopAppButton
										type="button"
										size="sm"
										variant={isBriefRecording ? 'danger' : 'ghost'}
										disabled={busyKeys.has('voice:brief')}
										onClick={onToggleVoiceCapture}
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
									id="site-studio-setup-brief"
									value={form.brief}
									onChange={(event) =>
										onFormChange((previous) => ({
											...previous,
											brief: event.target.value,
										}))
									}
									rows={9}
									className={cn(textareaClassName, 'min-h-32')}
									placeholder={t('setup.firstRun.briefPlaceholder')}
								/>
							</div>
						</div>

						<div className="flex flex-wrap gap-3">
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={busyKeys.has('create') || !form.site_title.trim()}
								onClick={() => onCreateWorkspace(false)}
							>
								{busyKeys.has('create') ? (
									<ArrowPathIcon className="h-4 w-4 animate-spin" />
								) : (
									<SparklesIcon className="h-4 w-4" />
								)}
								{t('setup.firstRun.createButton')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								disabled={
									busyKeys.has('create+provision') || !form.site_title.trim()
								}
								onClick={() => onCreateWorkspace(true)}
							>
								{busyKeys.has('create+provision') ? (
									<ArrowPathIcon className="h-4 w-4 animate-spin" />
								) : (
									<RocketLaunchIcon className="h-4 w-4" />
								)}
								{t('setup.firstRun.createAndLaunchButton')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								disabled={busyKeys.has('recover')}
								onClick={onRecoverExistingInstance}
							>
								<ArrowPathIcon className="h-4 w-4" />
								{t('setup.firstRun.recoverButton')}
							</DesktopAppButton>
						</div>

						{setupError}
					</div>

					<div className={cn(introShellClassName, 'space-y-4 p-5')}>
						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('setup.firstRun.outcomeTitle')}
							</DesktopAppSectionLabel>
							<p className="text-sm leading-6 text-(--desktop-text-secondary)">
								{t('setup.firstRun.outcomeDescription')}
							</p>
						</div>
						<div className="grid gap-3 text-sm text-(--desktop-text-secondary)">
							<DesktopAppSurface variant="soft" padding="sm">
								{t('setup.firstRun.outcomeAssistant')}
							</DesktopAppSurface>
							<DesktopAppSurface variant="soft" padding="sm">
								{t('setup.firstRun.outcomePublic')}
							</DesktopAppSurface>
							<DesktopAppSurface variant="soft" padding="sm">
								{t('setup.firstRun.outcomeAdmin')}
							</DesktopAppSurface>
							<DesktopAppSurface variant="soft" padding="sm">
								{t('setup.firstRun.outcomeReview')}
							</DesktopAppSurface>
						</div>
					</div>
				</div>
			</div>
		</DesktopAppContentWrapper>
	);
};

export default SiteStudioFirstRunPanel;
