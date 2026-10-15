/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced + deduped обновление companion полей window payload (EWA shell_context) без лишних PATCH shell-state.
 *
 * Invariants:
 * - onPayloadChange вызывается только при реальном изменении строки; не на каждый render store.
 *
 * Related:
 * - `UltimateDocEditorInner.tsx`, `useDesktopShellWindowPersistence.ts`
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import {
	DOC_EDITOR_COMPANION_EXCERPT_DEBOUNCE_MS,
	DOC_EDITOR_COMPANION_SELECTION_DEBOUNCE_MS,
} from '../utils/docEditorPersistTiming';
import { contentToPlainText } from '../utils/ultimateDocEditorBootstrap';
import type { UltimateDocEditorProps } from '../types/editor.types';

function emitIfChanged(
	onPayloadChange: UltimateDocEditorProps['onPayloadChange'],
	lastSentRef: MutableRefObject<Record<string, string>>,
	patch: Record<string, string>
): void {
	if (!onPayloadChange) return;
	const changed: Record<string, string> = {};
	for (const [key, value] of Object.entries(patch)) {
		if (lastSentRef.current[key] === value) continue;
		lastSentRef.current[key] = value;
		changed[key] = value;
	}
	if (Object.keys(changed).length > 0) {
		onPayloadChange(changed);
	}
}

export function useDocEditorCompanionShellPayload(params: {
	embedded: boolean;
	onPayloadChange?: UltimateDocEditorProps['onPayloadChange'];
	currentDocumentContent: string;
	currentContentHtml: string;
	aiDocumentContext: string;
	selectedText: string;
	unifiedContentId?: string;
	documentTitle?: string;
}): void {
	const {
		embedded,
		onPayloadChange,
		currentDocumentContent,
		currentContentHtml,
		aiDocumentContext,
		selectedText,
		unifiedContentId,
		documentTitle,
	} = params;

	const lastSentRef = useRef<Record<string, string>>({});

	useEffect(() => {
		const excerptMax = 2800;
		if (!embedded || !onPayloadChange) return;
		const timer = window.setTimeout(() => {
			const html = currentDocumentContent || currentContentHtml || '';
			const plainFromHtml = contentToPlainText(html).trim();
			const plain = plainFromHtml || (aiDocumentContext || '').trim();
			if (!plain) {
				emitIfChanged(onPayloadChange, lastSentRef, {
					companionSurfaceExcerpt: '',
				});
				return;
			}
			let clipped = plain;
			if (clipped.length > excerptMax) {
				clipped = `${clipped.slice(0, excerptMax - 1).trimEnd()}…`;
			}
			emitIfChanged(onPayloadChange, lastSentRef, {
				companionSurfaceExcerpt: clipped,
			});
		}, DOC_EDITOR_COMPANION_EXCERPT_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [
		embedded,
		onPayloadChange,
		currentDocumentContent,
		currentContentHtml,
		aiDocumentContext,
	]);

	useEffect(() => {
		const selMax = 2800;
		if (!embedded || !onPayloadChange) return;
		const timer = window.setTimeout(() => {
			const raw = (selectedText ?? '').trim();
			if (!raw) {
				emitIfChanged(onPayloadChange, lastSentRef, {
					companionSurfaceSelectionPlain: '',
				});
				return;
			}
			let clipped = raw;
			if (clipped.length > selMax) {
				clipped = `${clipped.slice(0, selMax - 1).trimEnd()}…`;
			}
			emitIfChanged(onPayloadChange, lastSentRef, {
				companionSurfaceSelectionPlain: clipped,
			});
		}, DOC_EDITOR_COMPANION_SELECTION_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [embedded, onPayloadChange, selectedText]);

	useEffect(() => {
		if (!embedded || !onPayloadChange) return;
		const uid =
			typeof unifiedContentId === 'string' ? unifiedContentId.trim() : '';
		const ttl = (documentTitle || '').replace(/\s+/g, ' ').trim();
		if (!uid) {
			emitIfChanged(onPayloadChange, lastSentRef, {
				companionListingPlain: '',
			});
			return;
		}
		const label = ttl || 'untitled';
		const line = `- ${label.slice(0, 400)} [document] uc=${uid}`;
		emitIfChanged(onPayloadChange, lastSentRef, {
			companionListingPlain: line,
		});
	}, [embedded, onPayloadChange, unifiedContentId, documentTitle]);
}
