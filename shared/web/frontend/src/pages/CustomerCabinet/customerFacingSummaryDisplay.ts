import type {
	CustomerFacingSummaryRecord,
	CustomerFacingSummaryPayload,
} from '@/pages/MarketingCabinet/marketingCabinetApi';

export type CustomerFacingSummaryDisplay = {
	headline: string;
	intro: string;
	bullets: string[];
	metrics: Array<{ label: string; value: string }>;
	hasBody: boolean;
};

/** payload из jsonb иногда приходит строкой (двойное кодирование / legacy). */
function coercePayload(
	raw: CustomerFacingSummaryPayload | string | null | undefined
): CustomerFacingSummaryPayload {
	if (raw == null) {
		return {};
	}
	if (typeof raw === 'string') {
		const s = raw.trim();
		if (!s) {
			return {};
		}
		try {
			const parsed: unknown = JSON.parse(s);
			if (
				parsed !== null &&
				typeof parsed === 'object' &&
				!Array.isArray(parsed)
			) {
				return parsed as CustomerFacingSummaryPayload;
			}
		} catch {
			return {};
		}
		return {};
	}
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		return raw;
	}
	return {};
}

function normalizePayload(pl: CustomerFacingSummaryPayload | null | undefined) {
	const raw = pl ?? {};
	const headline =
		typeof raw.headline === 'string' && raw.headline.trim()
			? raw.headline.trim()
			: '';
	const intro =
		typeof raw.intro === 'string' && raw.intro.trim() ? raw.intro.trim() : '';
	const bullets = Array.isArray(raw.bullets)
		? raw.bullets
				.map(String)
				.map((s) => s.trim())
				.filter(Boolean)
		: [];
	const metrics = Array.isArray(raw.metrics)
		? raw.metrics
				.filter(
					(x): x is { label: string; value: string } =>
						Boolean(x) &&
						typeof (x as { label?: string }).label === 'string' &&
						typeof (x as { value?: string }).value === 'string'
				)
				.map((x) => ({
					label: x.label.trim(),
					value: x.value.trim(),
				}))
				.filter((x) => x.label || x.value)
		: [];
	return { headline, intro, bullets, metrics };
}

/** Разбор записи сводки для экрана заказчика (тот же контракт, что и в редакторе лида). */
export function parseCustomerFacingSummaryRecord(
	rec: CustomerFacingSummaryRecord | null | undefined
): CustomerFacingSummaryDisplay {
	if (!rec) {
		return {
			headline: '',
			intro: '',
			bullets: [],
			metrics: [],
			hasBody: false,
		};
	}
	const { headline, intro, bullets, metrics } = normalizePayload(
		coercePayload(rec.payload)
	);
	const hasBody = Boolean(
		headline || intro || bullets.length > 0 || metrics.length > 0
	);
	return { headline, intro, bullets, metrics, hasBody };
}

export function customerFacingSummaryResponseHasBody(
	data: { summary?: CustomerFacingSummaryRecord | null } | null | undefined
): boolean {
	return parseCustomerFacingSummaryRecord(data?.summary ?? null).hasBody;
}
