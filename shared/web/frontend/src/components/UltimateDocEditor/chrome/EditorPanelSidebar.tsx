/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Left icon rail for Ultimate Doc Editor panels and voice dictation.
 *
 * Invariants:
 * - Rail `active` matches `panelOpen` from store (overlay visibility).
 * - Section dividers stay short hairlines; icon active state is soft accent mix (not opaque slab).
 *
 * Related:
 * - docEditorSidebarChrome.ts, UltimateDocEditorMainGrid.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import {
	ArrowPathIcon,
	ChartBarSquareIcon,
	CodeBracketSquareIcon,
	DocumentCheckIcon,
	DocumentTextIcon,
	MicrophoneIcon,
	PhotoIcon,
	QrCodeIcon,
	SparklesIcon,
	SpeakerXMarkIcon,
	TableCellsIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { TooltipV2 } from '@/components/ui/TooltipV2';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { transcribe, useMicRecorder } from '@/voice-core';
import type { OverlayKey } from '../hooks/docEditorPanelKeys';
import {
	DOC_EDITOR_SIDEBAR_COLUMN_CLASS,
	DOC_EDITOR_SIDEBAR_ICON_BUTTON_ACTIVE_CLASS,
	DOC_EDITOR_SIDEBAR_ICON_BUTTON_CLASS,
	DOC_EDITOR_SIDEBAR_SECTION_DIVIDER_CLASS,
	DOC_EDITOR_SIDEBAR_VOICE_BUSY_CLASS,
} from './docEditorSidebarChrome';

export interface EditorPanelSidebarProps {
	panelOpen: Record<OverlayKey, boolean>;
	onTogglePanel: (key: OverlayKey) => void;
	onVoiceDictateInsert: (plainText: string) => void;
}

type SidebarPanelEntry = {
	kind: 'panel';
	key: OverlayKey;
	labelKey: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};
type SidebarVoiceDictateEntry = { kind: 'voiceDictate' };
type SidebarEntry = SidebarPanelEntry | SidebarVoiceDictateEntry;

const SIDEBAR_SECTIONS: Array<Array<SidebarEntry>> = [
	[
		{ kind: 'panel', key: 'ai', labelKey: 'sidebar.ai', icon: SparklesIcon },
		{
			kind: 'panel',
			key: 'image',
			labelKey: 'sidebar.imageGeneration',
			icon: PhotoIcon,
		},
	],
	[
		{
			kind: 'panel',
			key: 'table',
			labelKey: 'sidebar.table',
			icon: TableCellsIcon,
		},
		{
			kind: 'panel',
			key: 'math',
			labelKey: 'sidebar.math',
			icon: CodeBracketSquareIcon,
		},
		{
			kind: 'panel',
			key: 'charts',
			labelKey: 'sidebar.charts',
			icon: ChartBarSquareIcon,
		},
		{
			kind: 'panel',
			key: 'pdf',
			labelKey: 'sidebar.pdf',
			icon: DocumentTextIcon,
		},
		{ kind: 'panel', key: 'ocr', labelKey: 'sidebar.ocr', icon: QrCodeIcon },
		{
			kind: 'panel',
			key: 'templates',
			labelKey: 'sidebar.templates',
			icon: DocumentCheckIcon,
		},
	],
	[{ kind: 'voiceDictate' }],
];

const DocEditorVoiceDictateSidebarButton: React.FC<{
	onInsert: (plainText: string) => void;
}> = ({ onInsert }) => {
	const { t, i18n } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [voiceError, setVoiceError] = useState<string | null>(null);
	const {
		isRecording,
		start,
		stop: stopMic,
		error: micError,
	} = useMicRecorder();

	const label = t('sidebar.voiceDictate');
	const transcribeLang = i18n.language.startsWith('ru') ? 'ru' : 'en';

	const toggleVoice = useCallback(async () => {
		setVoiceError(null);
		if (isTranscribing) {
			return;
		}
		if (isRecording) {
			const blob = await stopMic();
			if (!blob) {
				return;
			}
			setIsTranscribing(true);
			try {
				const file = new File([blob], 'doc-voice-dictation.webm', {
					type: blob.type || 'audio/webm',
				});
				const result = await transcribe(file, { language: transcribeLang });
				const text = (result.text ?? '').trim();
				if (text) {
					onInsert(text);
				} else {
					setVoiceError(t('sidebar.voiceEmpty'));
				}
			} catch (e: unknown) {
				const detail =
					e &&
					typeof e === 'object' &&
					'response' in e &&
					e.response &&
					typeof e.response === 'object' &&
					'data' in e.response &&
					e.response.data &&
					typeof e.response.data === 'object' &&
					'detail' in e.response.data
						? String((e.response as { data: { detail?: string } }).data.detail)
						: e instanceof Error
							? e.message
							: t('sidebar.voiceErrorGeneric');
				setVoiceError(
					detail.length > 60 ? t('sidebar.voiceErrorGeneric') : detail
				);
			} finally {
				setIsTranscribing(false);
			}
		} else {
			await start();
		}
	}, [
		isRecording,
		isTranscribing,
		onInsert,
		start,
		stopMic,
		t,
		transcribeLang,
	]);

	const busy = isRecording || isTranscribing;
	const statusExtra = voiceError ?? micError?.message;
	const tooltip = statusExtra
		? `${label} — ${statusExtra}`
		: isTranscribing
			? `${label} — ${t('sidebar.voiceTranscribing')}`
			: isRecording
				? `${label} — ${t('sidebar.voiceStopToInsert')}`
				: label;

	return (
		<TooltipV2 content={tooltip} placement="right">
			<DesktopAppButton
				type="button"
				onClick={() => void toggleVoice()}
				variant="ghost"
				active={busy}
				size="icon"
				className={cn(
					busy
						? DOC_EDITOR_SIDEBAR_VOICE_BUSY_CLASS
						: DOC_EDITOR_SIDEBAR_ICON_BUTTON_CLASS
				)}
				aria-label={label}
				aria-busy={busy}
			>
				{isTranscribing ? (
					<ArrowPathIcon width={16} height={16} className="animate-spin" />
				) : isRecording ? (
					<SpeakerXMarkIcon width={16} height={16} />
				) : (
					<MicrophoneIcon width={16} height={16} />
				)}
			</DesktopAppButton>
		</TooltipV2>
	);
};

export const EditorPanelSidebar = React.memo<EditorPanelSidebarProps>(
	function EditorPanelSidebar({
		panelOpen,
		onTogglePanel,
		onVoiceDictateInsert,
	}) {
		const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
		const panelBtn = (
			key: OverlayKey,
			labelKey: string,
			Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
		) => {
			const label = t(labelKey);
			const open = panelOpen[key];
			return (
				<TooltipV2 key={key} content={label} placement="right">
					<DesktopAppButton
						type="button"
						onClick={() => onTogglePanel(key)}
						variant="ghost"
						active={open}
						size="icon"
						className={cn(
							open
								? DOC_EDITOR_SIDEBAR_ICON_BUTTON_ACTIVE_CLASS
								: DOC_EDITOR_SIDEBAR_ICON_BUTTON_CLASS
						)}
						aria-label={label}
						aria-pressed={open}
					>
						<Icon width={16} height={16} />
					</DesktopAppButton>
				</TooltipV2>
			);
		};
		return (
			<div
				className={DOC_EDITOR_SIDEBAR_COLUMN_CLASS}
				data-doc-guide="editor-panel-rail"
			>
				{SIDEBAR_SECTIONS.map((section, sectionIndex) => (
					<React.Fragment
						key={section
							.map((e) => (e.kind === 'voiceDictate' ? 'voice-dictate' : e.key))
							.join('-')}
					>
						{sectionIndex > 0 ? (
							<div
								className={DOC_EDITOR_SIDEBAR_SECTION_DIVIDER_CLASS}
								aria-hidden
							/>
						) : null}
						{section.map((entry) =>
							entry.kind === 'voiceDictate' ? (
								<DocEditorVoiceDictateSidebarButton
									key="voice-dictate"
									onInsert={onVoiceDictateInsert}
								/>
							) : (
								panelBtn(entry.key, entry.labelKey, entry.icon)
							)
						)}
					</React.Fragment>
				))}
			</div>
		);
	}
);
