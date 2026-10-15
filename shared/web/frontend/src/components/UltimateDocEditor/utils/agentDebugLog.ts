/** Debug ddc74d: ingest только в DEV; в prod — console.debug (CSP не блокирует). */
export function agentDebugLog(payload: Record<string, unknown>): void {
	const body = { sessionId: 'ddc74d', ...payload, timestamp: Date.now() };
	if (import.meta.env.DEV) {
		fetch('http://127.0.0.1:7723/ingest/c1acd04c-e37f-4053-8bd9-86cae0a7fb52', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Debug-Session-Id': 'ddc74d',
			},
			body: JSON.stringify(body),
		}).catch(() => {});
	}
	if (typeof console !== 'undefined' && console.debug) {
		console.debug('[agent-debug]', body);
	}
}
