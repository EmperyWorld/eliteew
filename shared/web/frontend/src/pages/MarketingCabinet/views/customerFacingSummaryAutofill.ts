import type { MarketingProjectDashboard } from '../marketingCabinetApi';

export type CustomerSummaryAutofillDraft = {
	headline: string;
	intro: string;
	bullets: string[];
	metrics: Array<{ metricKey: string; value: string }>;
};

const INTRO_MAX = 4000;
const BULLET_MAX = 500;

function clampText(s: string, max: number): string {
	const t = s.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1).trimEnd()}…`;
}

function joinIntroParts(parts: string[]): string {
	return parts
		.map((p) => p.trim())
		.filter(Boolean)
		.join('\n\n')
		.slice(0, INTRO_MAX);
}

function dedupeBullets(items: string[], cap: number): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = clampText(raw, BULLET_MAX);
		if (!v) continue;
		const k = v.toLowerCase();
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(v);
		if (out.length >= cap) break;
	}
	return out;
}

/** Заголовок и вступление из карточки проекта и компании. */
export function buildCustomerSummaryAutofillBasics(
	d: MarketingProjectDashboard,
	fallbackProjectTitle: string
): Pick<CustomerSummaryAutofillDraft, 'headline' | 'intro'> {
	const p = d.project;
	const name = (p.name ?? '').trim() || fallbackProjectTitle;
	const company = (p.company_name ?? '').trim();
	const headline = company ? `${name} — ${company}` : name;

	const intro = joinIntroParts([
		(p.description ?? '').trim(),
		(p.goals ?? '').trim(),
		(p.key_tasks ?? '').trim(),
	]);

	return { headline: clampText(headline, 200), intro };
}

/** Пункты списка из JTBD, ценностных предложений и кратких инсайтов обзора. */
export function buildCustomerSummaryAutofillBullets(
	d: MarketingProjectDashboard,
	maxBullets = 10
): string[] {
	const fromJtbd = (d.job_stories ?? []).map((s) => {
		const title = (s.title ?? '').trim();
		if (title) return title;
		return clampText(s.statement ?? '', 240);
	});

	const fromVp = (d.value_propositions ?? []).flatMap((vp) => {
		const h = (vp.headline ?? '').trim();
		const vs = (vp.value_statement ?? '').trim();
		const sub = (vp.subheadline ?? '').trim();
		return [h, vs || sub].filter(Boolean);
	});

	const fromHighlights = (d.highlights ?? []).map((h) => {
		const title = (h.title ?? '').trim();
		const desc = (h.description ?? '').trim();
		if (title && desc && desc.length < 180) return `${title}: ${desc}`;
		return title || clampText(desc, 240);
	});

	const fromSwot = d.swot?.executive_summary?.trim()
		? [d.swot.executive_summary.trim()]
		: [];

	return dedupeBullets(
		[...fromJtbd, ...fromVp, ...fromHighlights, ...fromSwot],
		maxBullets
	);
}

/** Показатели из счётчиков кабинета и снимка проекта (подписи — i18n по metricKey). */
export function buildCustomerSummaryAutofillMetrics(
	d: MarketingProjectDashboard
): Array<{ metricKey: string; value: string }> {
	const p = d.project;
	const c = d.counts;
	const out: Array<{ metricKey: string; value: string }> = [];

	if (p.company_name?.trim()) {
		out.push({ metricKey: 'company', value: p.company_name.trim() });
	}
	if (p.company_industry?.trim()) {
		out.push({ metricKey: 'industry', value: p.company_industry.trim() });
	}
	if (typeof c?.jtbd === 'number') {
		out.push({ metricKey: 'jtbdCount', value: String(c.jtbd) });
	}
	if (typeof c?.value_propositions === 'number') {
		out.push({
			metricKey: 'vpCount',
			value: String(c.value_propositions),
		});
	}
	if (typeof d.readiness_score === 'number') {
		out.push({
			metricKey: 'readiness',
			value: String(Math.round(d.readiness_score)),
		});
	}
	if (typeof d.strategy_integrity_score === 'number') {
		out.push({
			metricKey: 'strategyIntegrity',
			value: String(Math.round(d.strategy_integrity_score)),
		});
	}

	return out;
}

export function buildCustomerSummaryAutofillAll(
	d: MarketingProjectDashboard,
	fallbackProjectTitle: string
): CustomerSummaryAutofillDraft {
	return {
		...buildCustomerSummaryAutofillBasics(d, fallbackProjectTitle),
		bullets: buildCustomerSummaryAutofillBullets(d),
		metrics: buildCustomerSummaryAutofillMetrics(d),
	};
}
