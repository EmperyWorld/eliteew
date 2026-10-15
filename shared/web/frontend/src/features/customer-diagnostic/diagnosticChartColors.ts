/** Подложки Recharts / rgba для столбцов на тёмном фоне. */

export function hexToRgba(hex: string, alpha: number): string {
	const raw = hex.trim().replace('#', '');
	if (raw.length !== 6 || alpha < 0 || alpha > 1) {
		return hex;
	}
	const r = Number.parseInt(raw.slice(0, 2), 16);
	const g = Number.parseInt(raw.slice(2, 4), 16);
	const b = Number.parseInt(raw.slice(4, 6), 16);
	if (Number.isNaN(r + g + b)) return hex;
	return `rgba(${r},${g},${b},${alpha})`;
}
