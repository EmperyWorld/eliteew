/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure per-message derivation for Desktop AI Chat thread rows (flags before JSX).
 *
 * Invariants:
 * - Live/finalizing assistant keeps streaming path (no blueprint/expert remount).
 * - Evidence sources only for non-live assistant bubbles.
 * - Wave F2: wide layout when council_transcript is present (Process tab chrome).
 *
 * Related:
 * - DesktopAiChatMessageRow.tsx
 * - utils/desktopAiExpertDocument.ts
 * - desktopChatDocumentReplacement.ts (normalizeDesktopCouncilTranscript)
 */
import {
	isDesktopEnsembleBlueprintArtifactMessage,
	type DesktopAiChatItem,
	type DesktopAiChatParticipant,
	type DesktopAiContextSource,
	type DesktopAiMessage,
} from '../../api/desktopChatClient';
import {
	desktopEnsembleBubbleTintHex,
	getDesktopAiHero,
	heroAvatarPublicPath,
} from '../../desktopAiHeroes';
import { resolveDesktopAiMessageEvidenceSources } from '../../desktopAiEvidence';
import { normalizeDesktopCouncilTranscript } from '../../desktopChatDocumentReplacement';
import {
	normalizeWebSearchSources,
	resolveMessageWebSearchSources,
	type DesktopAiWebSearchSource,
} from '../../desktopWebSearchSources';
import {
	assistantContributorHeroIds,
	assistantSpeakerChips,
	assistantSpeakerLabel,
} from '../../utils/desktopAiChatExport';
import { formatMessageClock } from '../../utils/desktopAiChatFormatters';
import { isPersistedDesktopAiMessageId } from '../../utils/desktopAiChatMessageIds';
import { isDesktopAiChatOwnUserMessage } from '../../utils/desktopAiChatOwnUserMessage';
import {
	analyzeDesktopAiExpertDocument,
	type DesktopAiExpertDocumentAnalysis,
} from '../../utils/desktopAiExpertDocument';

const EMPTY_EXPERT_DOCUMENT_ANALYSIS: DesktopAiExpertDocumentAnalysis = {
	isDocument: false,
	contractApplied: false,
	headings: [],
	sectionCount: 0,
	tableCount: 0,
	diagramCount: 0,
	codeBlockCount: 0,
	checklistCount: 0,
	sourceCount: 0,
	wordCount: 0,
	artifactKind: 'analysis',
};

export type BuildDesktopAiChatMessageRowModelInput = {
	message: DesktopAiMessage;
	compactTop: boolean;
	messages: DesktopAiMessage[];
	sending: boolean;
	i18nLanguage: string;
	activeHeroId: string | null;
	assistantHeaderLabel: string;
	isEnsembleActive: boolean;
	ensembleDocConfirm: unknown;
	soloSendsBlocked: boolean;
	canRegenerate: boolean;
	canDeleteMessages: boolean;
	isSharedChat: boolean;
	currentUserId: string | null;
	activeChat: DesktopAiChatItem | null;
	webSearchSourcesByMessageId: Record<string, DesktopAiWebSearchSource[]>;
	peerAuthorFallback: string;
};

export type DesktopAiChatMessageRowModel = {
	message: DesktopAiMessage;
	compactTop: boolean;
	clock: string | null;
	isLiveStreamingBubble: boolean;
	isBlueprintArtifact: boolean;
	messageWebSearchSources: DesktopAiWebSearchSource[];
	messageEvidenceSources: DesktopAiContextSource[];
	expertDocumentAnalysis: DesktopAiExpertDocumentAnalysis;
	showExpertDocument: boolean;
	useWideDocumentLayout: boolean;
	showRegenerate: boolean;
	bubbleHeroId: string | null;
	bubbleAvatarPath: string | null;
	bubbleSpeakerLabel: string;
	speakerChips: ReturnType<typeof assistantSpeakerChips>;
	ensembleBubbleTint: string | undefined;
	showEnsembleSpeakerLabel: boolean;
	userBubbleShowActions: boolean;
	isOwnUserBubble: boolean;
	sharedAuthorLabel: string | null;
	participantForAuthor: DesktopAiChatParticipant | undefined;
	peerAuthorLabel: string | null;
	userBubbleAlignEnd: boolean;
	showUserCopy: boolean;
	userBubbleShowActionsOwned: boolean;
	assistantBubbleShowToolbar: boolean;
	showSaveBlueprintToProject: boolean;
	assistantToolbarPadRight: string;
	userBubblePadRight: string;
};

export function buildDesktopAiChatMessageRowModel(
	input: BuildDesktopAiChatMessageRowModelInput
): DesktopAiChatMessageRowModel {
	const {
		message: m,
		compactTop,
		messages,
		sending,
		i18nLanguage,
		activeHeroId,
		assistantHeaderLabel,
		isEnsembleActive,
		ensembleDocConfirm,
		soloSendsBlocked,
		canRegenerate,
		canDeleteMessages,
		isSharedChat,
		currentUserId,
		activeChat,
		webSearchSourcesByMessageId,
		peerAuthorFallback,
	} = input;

	const clock = formatMessageClock(m.created_at, i18nLanguage);
	const last = messages[messages.length - 1];
	const isLastAssistant = m.role === 'assistant' && last?.id === m.id;
	const isLiveStreamingBubble =
		isLastAssistant &&
		(sending || m.metadata?.desktop_stream_finalizing === true);
	const isBlueprintArtifact =
		m.role === 'assistant' &&
		!isLiveStreamingBubble &&
		isDesktopEnsembleBlueprintArtifactMessage(m);
	const messageWebSearchSources =
		m.role === 'assistant' && !isLiveStreamingBubble
			? normalizeWebSearchSources([
					...(webSearchSourcesByMessageId[m.id] ?? []),
					...resolveMessageWebSearchSources(m.metadata),
				])
			: [];
	const messageEvidenceSources =
		m.role === 'assistant' && !isLiveStreamingBubble
			? resolveDesktopAiMessageEvidenceSources(
					m.metadata,
					messageWebSearchSources
				)
			: [];
	const expertDocumentAnalysis = isLiveStreamingBubble
		? EMPTY_EXPERT_DOCUMENT_ANALYSIS
		: analyzeDesktopAiExpertDocument(m.content, m.metadata, {
				sourceCount: messageEvidenceSources.length,
			});
	const hasCouncilTranscript = Boolean(
		normalizeDesktopCouncilTranscript(m.metadata?.council_transcript)
	);
	const showExpertDocument =
		m.role === 'assistant' &&
		!isBlueprintArtifact &&
		!isLiveStreamingBubble &&
		(expertDocumentAnalysis.isDocument ||
			(hasCouncilTranscript && (m.content || '').trim().length >= 320));
	const useWideDocumentLayout =
		isBlueprintArtifact || showExpertDocument || hasCouncilTranscript;
	const showRegenerate =
		canRegenerate &&
		isLastAssistant &&
		!sending &&
		!isLiveStreamingBubble &&
		!ensembleDocConfirm &&
		!soloSendsBlocked &&
		Boolean((m.content || '').trim());
	const assistantContributorIds = assistantContributorHeroIds(m);
	const isJointAssistantBubble =
		m.role === 'assistant' &&
		m.metadata?.desktop_ensemble_joint === true &&
		assistantContributorIds.length > 1;
	const bubbleHeroId =
		m.role === 'assistant' && assistantContributorIds.length > 0
			? assistantContributorIds[0]
			: m.role === 'assistant'
				? activeHeroId
				: null;
	const bubbleAvatarPath = heroAvatarPublicPath(bubbleHeroId);
	const bubbleSpeakerLabel =
		assistantSpeakerLabel(m) ??
		getDesktopAiHero(bubbleHeroId ?? undefined)?.shortLabel ??
		assistantHeaderLabel;
	const speakerChips = assistantSpeakerChips(m);
	const ensembleBubbleTint =
		isEnsembleActive &&
		m.role === 'assistant' &&
		typeof bubbleHeroId === 'string' &&
		!isJointAssistantBubble
			? desktopEnsembleBubbleTintHex(bubbleHeroId)
			: undefined;
	const showEnsembleSpeakerLabel =
		isEnsembleActive &&
		m.role === 'assistant' &&
		Boolean(speakerChips.fullLabel);
	const userBubbleShowActions =
		m.role === 'user' &&
		canDeleteMessages &&
		isPersistedDesktopAiMessageId(m.id) &&
		!sending;
	const isOwnUserBubble =
		m.role === 'user' &&
		isDesktopAiChatOwnUserMessage(m, currentUserId, {
			isSharedChat,
			ownerUserId: activeChat?.owner_user_id ?? activeChat?.user_id,
		});
	const sharedAuthorLabel =
		m.role === 'user' &&
		isSharedChat &&
		typeof m.metadata?.author_display_name === 'string' &&
		m.metadata.author_display_name.trim()
			? m.metadata.author_display_name.trim()
			: null;
	const participantForAuthor =
		m.role === 'user' && !isOwnUserBubble
			? (activeChat?.participants ?? []).find(
					(p) =>
						p.user_id ===
						(typeof m.author_user_id === 'string'
							? m.author_user_id.trim()
							: (activeChat?.owner_user_id ?? activeChat?.user_id ?? '').trim())
				)
			: undefined;
	const peerAuthorLabel =
		m.role === 'user' && !isOwnUserBubble
			? sharedAuthorLabel ||
				participantForAuthor?.display_name ||
				peerAuthorFallback
			: null;
	const userBubbleAlignEnd = m.role === 'user' && isOwnUserBubble;
	const showUserCopy =
		m.role === 'user' &&
		isOwnUserBubble &&
		userBubbleShowActions &&
		Boolean((m.content || '').trim());
	const userBubbleShowActionsOwned = userBubbleShowActions && isOwnUserBubble;
	const assistantBubbleShowToolbar =
		m.role === 'assistant' &&
		Boolean(m.content) &&
		!(sending && m.content === '');
	const showSaveBlueprintToProject =
		assistantBubbleShowToolbar &&
		Boolean(activeChat?.project_id) &&
		isPersistedDesktopAiMessageId(m.id) &&
		isBlueprintArtifact &&
		Boolean((m.content || '').trim());
	const assistantToolbarButtonCount =
		(showRegenerate ? 1 : 0) + (assistantBubbleShowToolbar ? 1 : 0);
	const assistantToolbarPadRight =
		assistantToolbarButtonCount >= 3
			? 'pr-[6.75rem]'
			: assistantToolbarButtonCount === 2
				? 'pr-[4.75rem]'
				: assistantBubbleShowToolbar
					? 'pr-11'
					: 'pr-2';
	const userBubblePadRight = userBubbleShowActionsOwned
		? showUserCopy
			? 'pr-[4.75rem]'
			: 'pr-11'
		: '';

	return {
		message: m,
		compactTop,
		clock,
		isLiveStreamingBubble,
		isBlueprintArtifact,
		messageWebSearchSources,
		messageEvidenceSources,
		expertDocumentAnalysis,
		showExpertDocument,
		useWideDocumentLayout,
		showRegenerate,
		bubbleHeroId,
		bubbleAvatarPath,
		bubbleSpeakerLabel,
		speakerChips,
		ensembleBubbleTint,
		showEnsembleSpeakerLabel,
		userBubbleShowActions,
		isOwnUserBubble,
		sharedAuthorLabel,
		participantForAuthor,
		peerAuthorLabel,
		userBubbleAlignEnd,
		showUserCopy,
		userBubbleShowActionsOwned,
		assistantBubbleShowToolbar,
		showSaveBlueprintToProject,
		assistantToolbarPadRight,
		userBubblePadRight,
	};
}
