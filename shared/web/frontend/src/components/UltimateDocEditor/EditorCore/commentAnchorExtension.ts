/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TipTap comment anchor decorations — inline highlights for document threads
 * with optional telemetry profiling for slow decoration builds.
 *
 * Invariants:
 * - Anchor ranges are clamped to doc bounds before decoration creation.
 * - Plugin meta updates replace decorations; unmapped transactions preserve mapped set.
 *
 * Related:
 * - TiptapEditor.tsx
 * - ../types/editor.types.ts
 */

import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import i18n, { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import { log } from '../../../utils/logger';
import type {
	CommentAnchorMeta,
	CommentAnchorRange,
} from '../types/editor.types';

export const COMMENT_ANCHOR_PLUGIN_KEY = new PluginKey<DecorationSet>(
	'commentAnchors'
);
const COMMENT_ANCHOR_PROFILE_EVENT = 'ultimate-doc-editor-telemetry';
const COMMENT_ANCHOR_SLOW_MS = 8;
let lastCommentAnchorProfileEmitAt = 0;

export interface CommentAnchorDecorationMeta {
	anchors?: CommentAnchorRange[];
	anchorMeta?: Record<string, CommentAnchorMeta>;
	activeThreadId?: string | null;
}

type CommentAnchorProfilePhase = 'init' | 'apply';

const isCommentAnchorProfilingEnabled = (): boolean =>
	typeof import.meta.env.VITE_ULTIMATE_DOC_EDITOR_PROFILE === 'string'
		? import.meta.env.VITE_ULTIMATE_DOC_EDITOR_PROFILE !== 'false'
		: true;

const emitCommentAnchorProfile = (payload: {
	phase: CommentAnchorProfilePhase;
	durationMs: number;
	docSize: number;
	anchorCount: number;
	activeThread: boolean;
}): void => {
	if (typeof window === 'undefined' || !isCommentAnchorProfilingEnabled()) {
		return;
	}

	const now = Date.now();
	const shouldEmit =
		payload.durationMs >= COMMENT_ANCHOR_SLOW_MS ||
		payload.docSize >= 50_000 ||
		now - lastCommentAnchorProfileEmitAt > 4_000;
	if (!shouldEmit) {
		return;
	}

	lastCommentAnchorProfileEmitAt = now;
	window.dispatchEvent(
		new CustomEvent(COMMENT_ANCHOR_PROFILE_EVENT, {
			detail: {
				name: 'comment_anchor_decorations_profile',
				timestamp: new Date().toISOString(),
				...payload,
			},
		})
	);
	log.debug('TiptapEditor', 'Comment anchor decorations profile', payload);
};

function normalizeAnchorsForDoc(
	doc: ProseMirrorNode,
	anchors: CommentAnchorRange[]
): CommentAnchorRange[] {
	const maxPos = Math.max(1, doc.content.size);
	return anchors
		.map((anchor) => {
			const start = Math.min(Math.max(1, anchor.start), maxPos);
			const end = Math.min(Math.max(start + 1, anchor.end), maxPos);
			if (start >= end) {
				return null;
			}

			return {
				...anchor,
				start,
				end,
			};
		})
		.filter((anchor): anchor is CommentAnchorRange => anchor !== null);
}

function buildCommentAnchorDecorations(
	doc: ProseMirrorNode,
	anchors: CommentAnchorRange[],
	anchorMeta: Record<string, CommentAnchorMeta>,
	activeThreadId?: string | null,
	profilePhase: CommentAnchorProfilePhase = 'apply'
): DecorationSet {
	const startedAt = performance.now();
	const normalizedAnchors = normalizeAnchorsForDoc(doc, anchors);
	if (normalizedAnchors.length === 0) {
		emitCommentAnchorProfile({
			phase: profilePhase,
			durationMs: Number((performance.now() - startedAt).toFixed(2)),
			docSize: doc.content.size,
			anchorCount: 0,
			activeThread: Boolean(activeThreadId),
		});
		return DecorationSet.empty;
	}

	const decorations = normalizedAnchors.map((anchor) => {
		const classNames = ['comment-anchor-range'];
		if (anchor.resolved) {
			classNames.push('comment-anchor-resolved');
		} else {
			classNames.push('comment-anchor-open');
		}
		if (activeThreadId && anchor.threadId === activeThreadId) {
			classNames.push('comment-anchor-active');
		}

		const threadMeta = anchorMeta[anchor.threadId];
		const unresolved =
			threadMeta?.unresolvedComments ?? (anchor.resolved ? 0 : 1);
		const total = threadMeta?.totalComments ?? 1;
		const statusLabel =
			unresolved > 0
				? i18n.t(`${ULTIMATE_DOC_EDITOR_NS}:commentAnchors.statusOpen`)
				: i18n.t(`${ULTIMATE_DOC_EDITOR_NS}:commentAnchors.statusResolved`);
		const title = i18n.t(
			`${ULTIMATE_DOC_EDITOR_NS}:commentAnchors.anchorTitle`,
			{ status: statusLabel, unresolved, total }
		);

		return Decoration.inline(anchor.start, anchor.end, {
			class: classNames.join(' '),
			'data-comment-thread-id': anchor.threadId,
			title,
		});
	});

	const result = DecorationSet.create(doc, decorations);
	emitCommentAnchorProfile({
		phase: profilePhase,
		durationMs: Number((performance.now() - startedAt).toFixed(2)),
		docSize: doc.content.size,
		anchorCount: normalizedAnchors.length,
		activeThread: Boolean(activeThreadId),
	});
	return result;
}

export const CommentAnchorExtension = Extension.create({
	name: 'commentAnchors',
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: COMMENT_ANCHOR_PLUGIN_KEY,
				state: {
					init(_, state) {
						return buildCommentAnchorDecorations(
							state.doc,
							[],
							{},
							null,
							'init'
						);
					},
					apply(transaction, oldDecorationSet) {
						const mapped = oldDecorationSet.map(
							transaction.mapping,
							transaction.doc
						);
						const meta = transaction.getMeta(COMMENT_ANCHOR_PLUGIN_KEY) as
							| CommentAnchorDecorationMeta
							| undefined;
						if (!meta) {
							return mapped;
						}

						return buildCommentAnchorDecorations(
							transaction.doc,
							meta.anchors ?? [],
							meta.anchorMeta ?? {},
							meta.activeThreadId ?? null,
							'apply'
						);
					},
				},
				props: {
					decorations(state) {
						return this.getState(state);
					},
				},
			}),
		];
	},
});
