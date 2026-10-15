/** RUB formatting for admin dashboards and orders. */
export function formatRubles(
	amount: number,
	mode: 'full' | 'compact' = 'full'
): string {
	const n = Number.isFinite(amount) ? amount : 0;
	if (mode === 'compact') {
		if (Math.abs(n) >= 1_000_000) {
			return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')} млн ₽`;
		}
		if (Math.abs(n) >= 1000) {
			return `${Math.round(n / 1000)} тыс. ₽`;
		}
	}
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(n);
}
