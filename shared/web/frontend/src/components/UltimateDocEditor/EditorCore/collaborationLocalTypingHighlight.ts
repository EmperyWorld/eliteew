/**
 * Подсветка блока, в котором сейчас вводит локальный пользователь (только при совместном режиме).
 */
import { Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const COLLAB_LOCAL_TYPING_CLASS = 'doc-collab-local-typing-block';

export const collaborationLocalTypingHighlightKey = new PluginKey(
	'collaborationLocalTypingHighlight'
);

function buildDecorationSet(state: EditorState): DecorationSet {
	const $pos = state.selection.$from;
	for (let d = $pos.depth; d > 0; d--) {
		const node = $pos.node(d);
		if (node.isBlock && node.type.name !== 'doc') {
			const from = $pos.before(d);
			const to = $pos.after(d);
			return DecorationSet.create(state.doc, [
				Decoration.node(from, to, {
					class: COLLAB_LOCAL_TYPING_CLASS,
				}),
			]);
		}
	}
	return DecorationSet.empty;
}

export const CollaborationLocalTypingHighlight = Extension.create({
	name: 'collaborationLocalTypingHighlight',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: collaborationLocalTypingHighlightKey,
				state: {
					init(_, state) {
						return buildDecorationSet(state);
					},
					apply(tr, oldSet, _oldState, newState) {
						if (!tr.docChanged && !tr.selectionSet) {
							return oldSet.map(tr.mapping, newState.doc);
						}
						return buildDecorationSet(newState);
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
