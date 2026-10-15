/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist and restore GAF composer drafts when switching threads.
 *
 * Invariants:
 * - Save previous chat draft before loading the next; empty selection clears composer.
 *
 * Related:
 * - gafChatComposerDrafts.ts · GAFChatApp.tsx
 */
import {
	useEffect,
	useRef,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import {
	loadGafComposerDraft,
	saveGafComposerDraft,
} from '../gafChatComposerDrafts';
import type { GafPendingComposerAttachment } from '../gafChatComposerTypes';

export function useGafChatComposerDraftPersistence(options: {
	myUserId: string | null;
	selectedChatId: string | null;
	inputText: string;
	inputTextRef: MutableRefObject<string>;
	setInputText: Dispatch<SetStateAction<string>>;
	setPendingAttachments: Dispatch<
		SetStateAction<GafPendingComposerAttachment[]>
	>;
}) {
	const {
		myUserId,
		selectedChatId,
		inputText,
		inputTextRef,
		setInputText,
		setPendingAttachments,
	} = options;
	const prevChatIdForDraftRef = useRef<string | null>(null);

	useEffect(() => {
		if (!myUserId) return;
		const prev = prevChatIdForDraftRef.current;
		if (prev !== null && prev !== selectedChatId) {
			saveGafComposerDraft(myUserId, prev, inputTextRef.current);
		}
		prevChatIdForDraftRef.current = selectedChatId;
		if (selectedChatId) {
			if (prev !== selectedChatId) {
				setInputText(loadGafComposerDraft(myUserId, selectedChatId));
				setPendingAttachments([]);
			} else if (!inputTextRef.current.trim()) {
				setInputText(loadGafComposerDraft(myUserId, selectedChatId));
			}
		} else {
			setInputText('');
			setPendingAttachments([]);
		}
	}, [
		selectedChatId,
		myUserId,
		inputTextRef,
		setInputText,
		setPendingAttachments,
	]);

	useEffect(() => {
		if (!myUserId || !selectedChatId) return;
		const timer = window.setTimeout(() => {
			saveGafComposerDraft(myUserId, selectedChatId, inputText);
		}, 400);
		return () => window.clearTimeout(timer);
	}, [inputText, selectedChatId, myUserId]);
}
