/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve created document links for an agentic mission card (mirror + trace fallback).
 */

import { useEffect, useState } from 'react';

import { agenticCreatedDocumentsFromTrace } from '@/features/ewa/agentic/agenticCreatedDocumentsFromTrace';
import { fetchAgenticSessionTrace } from '@/features/ewa/agentic/agenticTraceApi';
import {
	extractAgenticSessionDocuments,
	type AgenticCreatedDocument,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

export function useAgenticSessionDocuments(
	run: EwaCompanionTaskRun | null | undefined,
	agenticSessionId: string | undefined
): AgenticCreatedDocument[] {
	const mirrored = extractAgenticSessionDocuments(run);
	const [traceDocs, setTraceDocs] = useState<AgenticCreatedDocument[]>([]);

	useEffect(() => {
		if (mirrored.length > 0) {
			setTraceDocs([]);
			return;
		}
		const sessionId = (agenticSessionId || '').trim();
		if (!sessionId) {
			setTraceDocs([]);
			return;
		}
		let cancelled = false;
		void fetchAgenticSessionTrace(sessionId, 120)
			.then((trace) => {
				if (cancelled) return;
				setTraceDocs(agenticCreatedDocumentsFromTrace(trace.checkpoints));
			})
			.catch(() => {
				if (!cancelled) setTraceDocs([]);
			});
		return () => {
			cancelled = true;
		};
	}, [mirrored.length, agenticSessionId]);

	return mirrored.length > 0 ? mirrored : traceDocs;
}
