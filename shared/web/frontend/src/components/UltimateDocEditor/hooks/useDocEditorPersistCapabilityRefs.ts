/**
 * Актуальные ref-флаги для autosave / unified path (снимок без лишних замыканий в интервалах).
 */

import { useEffect, useRef, type MutableRefObject } from 'react';

export interface UseDocEditorPersistCapabilityRefsParams {
	canPersistCanonical: boolean;
	canPersistUnifiedContent: boolean;
	payloadWantsUnifiedContent: boolean;
}

export interface UseDocEditorPersistCapabilityRefsResult {
	canPersistCanonicalRef: MutableRefObject<boolean>;
	canPersistUnifiedContentRef: MutableRefObject<boolean>;
	payloadWantsUnifiedContentRef: MutableRefObject<boolean>;
}

export function useDocEditorPersistCapabilityRefs(
	params: UseDocEditorPersistCapabilityRefsParams
): UseDocEditorPersistCapabilityRefsResult {
	const {
		canPersistCanonical,
		canPersistUnifiedContent,
		payloadWantsUnifiedContent,
	} = params;

	const canPersistCanonicalRef = useRef(true);
	const canPersistUnifiedContentRef = useRef(true);
	const payloadWantsUnifiedContentRef = useRef(false);

	useEffect(() => {
		canPersistCanonicalRef.current = canPersistCanonical;
	}, [canPersistCanonical]);
	useEffect(() => {
		canPersistUnifiedContentRef.current = canPersistUnifiedContent;
	}, [canPersistUnifiedContent]);
	useEffect(() => {
		payloadWantsUnifiedContentRef.current = payloadWantsUnifiedContent;
	}, [payloadWantsUnifiedContent]);

	return {
		canPersistCanonicalRef,
		canPersistUnifiedContentRef,
		payloadWantsUnifiedContentRef,
	};
}
