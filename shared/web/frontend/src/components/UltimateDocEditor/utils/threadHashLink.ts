export function parseThreadIdFromHash(hashValue: string): string | null {
	const rawHash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
	const queryIndex = rawHash.indexOf('?');
	if (queryIndex < 0) {
		return null;
	}

	const params = new URLSearchParams(rawHash.slice(queryIndex + 1));
	const threadId = params.get('thread')?.trim();
	return threadId || null;
}

export function clearThreadParamInHash(hashValue: string): string {
	const rawHash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
	const [pathPart, queryPart = ''] = rawHash.split('?');
	const hashPath = pathPart || 'document-editor';
	const params = new URLSearchParams(queryPart);
	params.delete('thread');
	const nextQuery = params.toString();
	return `#${nextQuery ? `${hashPath}?${nextQuery}` : hashPath}`;
}

export function buildThreadDeepLink(
	href: string,
	threadId: string,
	options?: { documentId?: string }
): string {
	const url = new URL(href);
	const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
	const [hashPathPart, hashQueryPart = ''] = rawHash.split('?');
	const hashPath = hashPathPart || 'document-editor';
	const hashParams = new URLSearchParams(hashQueryPart);
	hashParams.set('thread', threadId);
	if (options?.documentId) {
		hashParams.set('documentId', options.documentId);
	}
	const nextHash = hashParams.toString()
		? `${hashPath}?${hashParams.toString()}`
		: hashPath;
	url.hash = nextHash;
	return url.toString();
}
