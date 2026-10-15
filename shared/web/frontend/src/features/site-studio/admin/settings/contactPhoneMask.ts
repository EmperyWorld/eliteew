/** Normalize phone for API: leading + and digits, or empty. */
export function normalizePhoneForSave(display: string): string {
	const t = display.trim();
	if (!t) return '';
	if (t.startsWith('+')) {
		const digits = t.slice(1).replace(/\D/g, '');
		return digits ? `+${digits}` : '+';
	}
	const digits = t.replace(/\D/g, '');
	if (!digits) return '';
	if (digits.startsWith('8') && digits.length >= 11) {
		return `+7${digits.slice(1)}`;
	}
	if (digits.startsWith('7')) {
		return `+${digits}`;
	}
	return `+${digits}`;
}

/**
 * Format phone as user types (RU +7 emphasis; other countries: + and digits).
 */
export function maskPhoneInput(display: string): string {
	const t = display.trim();
	if (!t) return '';
	if (t.startsWith('+') && t.length > 1 && t[1] !== '7' && t[1] !== '8') {
		return `+${t.slice(1).replace(/\D/g, '')}`;
	}
	let digits = display.replace(/\D/g, '');
	if (digits.startsWith('8')) {
		digits = `7${digits.slice(1)}`;
	}
	if (!digits) return '';
	if (!digits.startsWith('7') || digits.length === 1) {
		return digits.startsWith('7') ? `+${digits}` : `+${digits}`;
	}
	const rest = digits.slice(1);
	let out = '+7';
	if (rest.length > 0) out += ` (${rest.slice(0, 3)}`;
	if (rest.length >= 3) out += `) ${rest.slice(3, 6)}`;
	if (rest.length >= 6) out += `-${rest.slice(6, 8)}`;
	if (rest.length >= 8) out += `-${rest.slice(8, 10)}`;
	return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
	const t = email.trim();
	if (!t) return true;
	return EMAIL_RE.test(t);
}

export function phoneDigitCount(display: string): number {
	return display.replace(/\D/g, '').length;
}

export function isValidPhone(display: string): boolean {
	const t = display.trim();
	if (!t) return true;
	return phoneDigitCount(t) >= 10;
}
