/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Discussion mode contracts for Desktop AI Chat SPA.
 *
 * Invariants:
 * - Status and relation unions mirror backend Discussion contracts.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
export type DiscussionStatus =
	| 'queued'
	| 'running'
	| 'paused_checkpoint'
	| 'paused_user'
	| 'paused_goal'
	| 'paused_error'
	| 'completed'
	| 'cancelled';

export type DiscussionIntensity =
	| 'calm'
	| 'professional_confrontational'
	| 'sharp';

export type DiscussionActorType = 'ai' | 'user' | 'system';

export type DiscussionRelation =
	| 'opening'
	| 'support'
	| 'challenge'
	| 'rebuttal'
	| 'synthesis'
	| 'user_interjection'
	| 'moderator';

export type DiscussionPreset = {
	id: string;
	title_ru: string;
	title_en: string;
	description_ru: string;
	description_en: string;
	default_intensity: DiscussionIntensity;
	checkpoint_interval: number;
	min_roster: number;
	max_roster: number;
};

export type DiscussionTurn = {
	id: string;
	session_id: string;
	ordinal: number;
	actor_type: DiscussionActorType;
	hero_id?: string | null;
	author_user_id?: string | null;
	relation: DiscussionRelation | string;
	reply_to_turn_id?: string | null;
	tone?: string | null;
	content: string;
	metadata?: Record<string, unknown>;
	created_at?: string | null;
};

export type DiscussionSession = {
	id: string;
	chat_id: string;
	owner_user_id: string;
	anchor_message_id?: string | null;
	preset_id: string;
	topic: string;
	goal: string;
	roster: string[];
	intensity: DiscussionIntensity | string;
	status: DiscussionStatus;
	pause_reason?: string | null;
	pause_requested: boolean;
	total_ai_turns: number;
	checkpoint_ai_turns: number;
	segment_index: number;
	version: number;
	last_actor_hero_id?: string | null;
	document_markdown?: string | null;
	document_transcript_version?: number | null;
	document_stale: boolean;
	participant_display_name?: string;
	participant_role_title?: string;
	created_at?: string | null;
	updated_at?: string | null;
	turns?: DiscussionTurn[];
};

export type DiscussionControlVisibility = {
	raiseHand: boolean;
	continue: boolean;
	finish: boolean;
	cancel: boolean;
	generateDocument: boolean;
	composerEnabled: boolean;
};
