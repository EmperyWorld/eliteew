/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TipTap core extension stack for Ultimate Doc Editor — StarterKit, formatting,
 * tables, images, links, optional/math extensions, comment anchors, and collab typing highlight.
 *
 * Invariants:
 * - Schema must stay aligned with collabSeedYDoc.ts (seed uses includeCommentAnchors: false).
 * - Collaboration extensions and local typing highlight only when hasCollab is true.
 *
 * Related:
 * - TiptapEditorInner.tsx, collabSeedYDoc.ts, createOptionalTiptapExtensions.ts
 */
import type { AnyExtension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { registerCustomProtocol } from 'linkifyjs';
import { Placeholder } from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { CommentAnchorExtension } from './commentAnchorExtension';
import { CollaborationLocalTypingHighlight } from './collaborationLocalTypingHighlight';

let eliteewLinkifyBlobProtocolRegistered = false;

function ensureLinkifyBlobProtocolRegistered(): void {
	if (eliteewLinkifyBlobProtocolRegistered) return;
	eliteewLinkifyBlobProtocolRegistered = true;
	try {
		registerCustomProtocol('blob');
	} catch {
		/* idempotent — linkify may reject duplicate registration */
	}
}

ensureLinkifyBlobProtocolRegistered();

const CustomImage = Image.extend({
	addProseMirrorPlugins() {
		return [...(this.parent?.() || [])];
	},
});

export interface CreateCoreTiptapExtensionsOptions {
	editorPlaceholder: string;
	hasCollab?: boolean;
	optionalExtensions?: AnyExtension[];
	collaborationExtensions?: AnyExtension[];
	/** false for Yjs HTML seed (collabSeedYDoc) — decorations are runtime-only */
	includeCommentAnchors?: boolean;
}

export function createCoreTiptapExtensions({
	editorPlaceholder,
	hasCollab = false,
	optionalExtensions = [],
	collaborationExtensions = [],
	includeCommentAnchors = true,
}: CreateCoreTiptapExtensionsOptions): AnyExtension[] {
	return [
		StarterKit.configure({
			heading: { levels: [1, 2, 3, 4, 5, 6] },
			codeBlock: false,
			link: false,
			underline: false,
			horizontalRule: false,
			...(hasCollab ? { undoRedo: false as const } : {}),
		}),
		Placeholder.configure({
			placeholder: editorPlaceholder,
		}),
		TextStyle,
		Color.configure({
			types: ['textStyle'],
		}),
		Highlight.configure({
			multicolor: true,
			HTMLAttributes: {
				class: 'highlight',
			},
		}),
		Underline,
		Subscript,
		Superscript,
		TextAlign.configure({
			types: ['heading', 'paragraph'],
			defaultAlignment: 'left',
		}),
		FontFamily.configure({
			types: ['textStyle'],
		}),
		TaskList.configure({
			HTMLAttributes: {
				class: 'task-list',
			},
		}),
		TaskItem.configure({
			nested: true,
			HTMLAttributes: {
				class: 'task-item',
			},
		}),
		HorizontalRule.configure({
			HTMLAttributes: {
				class: 'horizontal-rule',
			},
		}),
		...(includeCommentAnchors ? [CommentAnchorExtension] : []),
		...optionalExtensions,
		...collaborationExtensions,
		...(hasCollab ? [CollaborationLocalTypingHighlight] : []),
		Table.configure({
			resizable: true,
			HTMLAttributes: {
				class: 'editor-table',
			},
		}),
		TableRow.configure({
			HTMLAttributes: {
				class: 'editor-table-row',
			},
		}),
		TableCell.configure({
			HTMLAttributes: {
				class: 'editor-table-cell',
			},
		}),
		TableHeader.configure({
			HTMLAttributes: {
				class: 'editor-table-header',
			},
		}),
		CustomImage.configure({
			inline: false,
			allowBase64: true,
			HTMLAttributes: {
				class: 'editor-content-image',
			},
		}),
		Link.configure({
			openOnClick: false,
			/** Иначе `blob:` (PDF из панели до upload) и кастомные схемы отбрасываются при parseHTML. */
			protocols: ['blob'],
			HTMLAttributes: {
				class: 'editor-link',
			},
		}),
	];
}
