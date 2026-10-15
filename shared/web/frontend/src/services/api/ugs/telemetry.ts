export const UGS_FRONTEND_TELEMETRY_EVENT = 'eliteew:ugs-frontend-telemetry';

export interface UgsFrontendTelemetryRecord {
	event:
		| 'deep_link_stored'
		| 'deep_link_consumed'
		| 'stream_started'
		| 'stream_result'
		| 'stream_error'
		| 'stream_cancelled';
	requestId?: string;
	view?: string | null;
	workflowId?: string | null;
	status?: string | null;
	timestamp: string;
	meta?: Record<string, unknown>;
}

export function emitUgsFrontendTelemetry(
	record: Omit<UgsFrontendTelemetryRecord, 'timestamp'>
): UgsFrontendTelemetryRecord {
	const payload: UgsFrontendTelemetryRecord = {
		...record,
		timestamp: new Date().toISOString(),
	};

	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent<UgsFrontendTelemetryRecord>(
				UGS_FRONTEND_TELEMETRY_EVENT,
				{
					detail: payload,
				}
			)
		);
	}

	return payload;
}
