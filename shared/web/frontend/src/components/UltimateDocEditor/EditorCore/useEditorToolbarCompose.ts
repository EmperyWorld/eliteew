/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose hook for Ultimate Doc Editor toolbar — i18n, motion preference, and
 * popover state; all hooks run before parent isUsableTiptapEditor guard.
 *
 * Invariants:
 * - Must not early-return; parent owns editor usability guard after this hook.
 *
 * Related:
 * - EditorToolbar.tsx, useEditorToolbarPopovers.ts
 */
import type { Editor } from '@tiptap/react';
import { useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import {
	useEditorToolbarPopovers,
	type UseEditorToolbarPopoversResult,
} from './useEditorToolbarPopovers';

export interface UseEditorToolbarComposeOptions {
	editor: Editor | null;
	closeSignal?: number;
	onRequestExclusiveOpen?: () => void;
}

export interface UseEditorToolbarComposeResult {
	reduceMotion: boolean | null;
	t: ReturnType<typeof useTranslation>['t'];
	popovers: UseEditorToolbarPopoversResult;
}

export function useEditorToolbarCompose({
	editor,
	closeSignal,
	onRequestExclusiveOpen,
}: UseEditorToolbarComposeOptions): UseEditorToolbarComposeResult {
	const reduceMotion = useReducedMotion();
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const popovers = useEditorToolbarPopovers({
		editor,
		closeSignal,
		onRequestExclusiveOpen,
		t,
	});

	return { reduceMotion, t, popovers };
}
