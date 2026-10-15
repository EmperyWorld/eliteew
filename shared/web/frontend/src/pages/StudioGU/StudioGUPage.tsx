/**
 * Студия ГУ — единое десктоп-приложение: диалог, штаб, Live Voice, транскрипция файлов.
 */

import * as React from 'react';
import { CreativeStudioGuideTourModal } from '@/components/guided-tour/CreativeStudioGuideTourModal';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopAppSurface,
	DesktopAppToolbar,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { getDesktopShellToolbarClusterClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';
import { STUDIO_GU_INITIAL_MODE_KEY } from './transcription/studioTranscriptionConstants';
import { StudioLiveTab } from './StudioLiveTab';
import { StudioTranscriptionTab } from './StudioTranscriptionTab';
import { VoiceDialogPanel } from './VoiceDialogPanel';
import { VoiceCommandCenter } from './voiceCommand/VoiceCommandCenter';
import {
	ChatBubbleLeftRightIcon,
	DocumentTextIcon,
	MicrophoneIcon,
	RadioIcon,
} from '@heroicons/react/24/outline';

import {
	getStudioGUGuideSteps,
	STUDIO_GU_GUIDE_AUDIO_LS_KEY,
	STUDIO_GU_GUIDE_ROOT_ID,
	STUDIO_GU_GUIDE_TOUR_FOLDER,
} from './studioGUGuideData';

export type StudioGUMode = 'dialog' | 'command' | 'live' | 'transcription';

const sw = DESKTOP_LUCIDE.stroke;

const MODES: {
	id: StudioGUMode;
	label: string;
	short: string;
	Icon: typeof MicrophoneIcon;
}[] = [
	{ id: 'dialog', label: 'Диалог', short: 'Диалог', Icon: MicrophoneIcon },
	{ id: 'command', label: 'Управление', short: 'Штаб', Icon: RadioIcon },
	{
		id: 'live',
		label: 'Live Voice',
		short: 'Live',
		Icon: ChatBubbleLeftRightIcon,
	},
	{
		id: 'transcription',
		label: 'Транскрипция',
		short: 'Текст',
		Icon: DocumentTextIcon,
	},
];

const StudioGUPage: React.FC = () => {
	const [mode, setMode] = React.useState<StudioGUMode>('dialog');
	const [studioGuTourOpen, setStudioGuTourOpen] = React.useState(false);
	const [commandGuideOpen, setCommandGuideOpen] = React.useState(false);
	const shellFrame = useDesktopShellFrame();
	const toolbarCluster = getDesktopShellToolbarClusterClassName(shellFrame);

	const studioGuGuideSteps = React.useMemo(() => {
		if (mode === 'dialog' || mode === 'live' || mode === 'transcription') {
			return getStudioGUGuideSteps(mode);
		}
		return [];
	}, [mode]);

	React.useEffect(() => {
		setStudioGuTourOpen(false);
		setCommandGuideOpen(false);
	}, []);

	const openStudioGuideTour = React.useCallback(() => {
		if (mode === 'command') {
			setCommandGuideOpen(true);
		} else {
			setStudioGuTourOpen(true);
		}
	}, [mode]);
	useDesktopGuideTourOpener(openStudioGuideTour);

	React.useEffect(() => {
		try {
			const m = sessionStorage.getItem(STUDIO_GU_INITIAL_MODE_KEY);
			if (
				m === 'transcription' ||
				m === 'dialog' ||
				m === 'command' ||
				m === 'live'
			) {
				setMode(m);
			}
			sessionStorage.removeItem(STUDIO_GU_INITIAL_MODE_KEY);
		} catch {
			// ignore
		}
	}, []);

	return (
		<div
			id={STUDIO_GU_GUIDE_ROOT_ID}
			className={cn(
				'relative flex h-full min-h-0 flex-col bg-transparent text-(--desktop-text-primary)'
			)}
		>
			<DesktopAppSurface
				variant="shell"
				className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 shadow-none"
				padding="none"
			>
				<DesktopAppToolbar className="shrink-0 gap-1 border-b border-(--desktop-border-subtle) bg-transparent px-2 py-2">
					<DesktopAppSectionLabel className="sr-only">
						Режимы Студии ГУ
					</DesktopAppSectionLabel>
					<div
						className={cn(
							'flex min-w-0 flex-1 flex-wrap items-center gap-1 p-1.5 rounded-(--desktop-radius-lg)',
							toolbarCluster
						)}
						data-studio-gu-guide="mode-rail"
					>
						{MODES.map(({ id, label, short, Icon }) => (
							<DesktopAppButton
								key={id}
								type="button"
								variant="ghost"
								size="sm"
								active={mode === id}
								onClick={() => setMode(id)}
								className={cn(
									'min-w-0 gap-1.5 px-2.5',
									mode === id &&
										'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)'
								)}
								aria-current={mode === id ? 'true' : undefined}
							>
								<Icon
									className="h-4 w-4 shrink-0"
									strokeWidth={sw}
									aria-hidden
								/>
								<span className="hidden sm:inline">{label}</span>
								<span className="sm:hidden">{short}</span>
							</DesktopAppButton>
						))}
					</div>
				</DesktopAppToolbar>

				<div
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.shell,
						'min-h-0 flex-1 overflow-hidden px-3 py-2 md:px-4 md:py-3'
					)}
				>
					<div className="flex h-full min-h-0 flex-col overflow-hidden">
						{mode === 'dialog' ? (
							<VoiceDialogPanel />
						) : mode === 'command' ? (
							<div className="flex h-full min-h-0 flex-col">
								<VoiceCommandCenter
									embeddedInStudio
									guideOpen={commandGuideOpen}
									onGuideOpenChange={setCommandGuideOpen}
								/>
							</div>
						) : mode === 'live' ? (
							<StudioLiveTab />
						) : (
							<StudioTranscriptionTab />
						)}
					</div>
				</div>
			</DesktopAppSurface>
			<CreativeStudioGuideTourModal
				open={studioGuTourOpen}
				onClose={() => setStudioGuTourOpen(false)}
				rootId={STUDIO_GU_GUIDE_ROOT_ID}
				steps={studioGuGuideSteps}
				audioLocalStorageKey={STUDIO_GU_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={STUDIO_GU_GUIDE_TOUR_FOLDER}
				spotlightLayoutKey={mode}
			/>
		</div>
	);
};

export default StudioGUPage;
