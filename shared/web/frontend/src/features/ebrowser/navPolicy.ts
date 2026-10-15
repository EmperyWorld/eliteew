/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure EBrowser HTTPS navigation policy evaluator (SPA pre-check mirror).
 *
 * Invariants:
 * - Modes exclusive; fail-closed when policy missing or TTL expired.
 * - HTTPS only (about:blank allowed); userinfo and non-443 ports denied.
 * - Rust on_navigation remains authoritative.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 * - shared/api/services/ebrowser/nav_policy.py
 */

export const POLICY_TTL_SECONDS = 300;

export type PolicyMode = 'open' | 'allowlist' | 'denylist';

export type DenyReason =
	| 'missing_policy'
	| 'expired'
	| 'scheme'
	| 'userinfo'
	| 'port'
	| 'host'
	| 'allowlist_miss'
	| 'denylist_hit'
	| 'invalid_url';

export type EBrowserNavPolicy = {
	mode: PolicyMode;
	allow: readonly string[];
	deny: readonly string[];
	fetchedAtMs: number | null;
	ttlSeconds?: number;
};

export type NavDecision = {
	allowed: boolean;
	reason: DenyReason | 'ok';
};

export function defaultOpenPolicy(nowMs = Date.now()): EBrowserNavPolicy {
	/** Explicit open-mode fixture (tests / admin-saved open). Not the missing-row default. */
	return {
		mode: 'open',
		allow: [],
		deny: [],
		fetchedAtMs: nowMs,
		ttlSeconds: POLICY_TTL_SECONDS,
	};
}

export function defaultDenyAllPolicy(nowMs = Date.now()): EBrowserNavPolicy {
	/** Missing DB row mirror: empty allowlist → HTTPS denied except about:blank. */
	return {
		mode: 'allowlist',
		allow: [],
		deny: [],
		fetchedAtMs: nowMs,
		ttlSeconds: POLICY_TTL_SECONDS,
	};
}

export function validatePolicyForSave(
	mode: PolicyMode,
	allow: readonly string[],
	deny: readonly string[]
): string | null {
	const allowN = allow.map((x) => x.trim()).filter(Boolean);
	const denyN = deny.map((x) => x.trim()).filter(Boolean);
	if (mode !== 'open' && mode !== 'allowlist' && mode !== 'denylist') {
		return 'invalid_mode';
	}
	if (mode === 'open' && (allowN.length > 0 || denyN.length > 0)) {
		return 'open_mode_lists_forbidden';
	}
	if (mode === 'allowlist' && denyN.length > 0) {
		return 'allowlist_deny_forbidden';
	}
	if (mode === 'denylist' && allowN.length > 0) {
		return 'denylist_allow_forbidden';
	}
	if (mode === 'denylist' && denyN.length === 0) {
		return 'denylist_empty_forbidden';
	}
	for (const entry of [...allowN, ...denyN]) {
		if (!entryWellFormed(entry)) return 'invalid_entry';
	}
	return null;
}

export function evaluateNavigation(
	url: string,
	policy: EBrowserNavPolicy | null | undefined,
	nowMs = Date.now()
): NavDecision {
	if (!policy || policy.fetchedAtMs == null) {
		return { allowed: false, reason: 'missing_policy' };
	}
	const ttl = Math.max(1, policy.ttlSeconds ?? POLICY_TTL_SECONDS);
	if (nowMs > policy.fetchedAtMs + ttl * 1000) {
		return { allowed: false, reason: 'expired' };
	}

	const raw = (url || '').trim();
	if (!raw) return { allowed: false, reason: 'invalid_url' };
	if (raw === 'about:blank' || raw.startsWith('about:blank?')) {
		return { allowed: true, reason: 'ok' };
	}

	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return { allowed: false, reason: 'invalid_url' };
	}

	const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
	if (
		scheme === 'javascript' ||
		scheme === 'data' ||
		scheme === 'blob' ||
		scheme === 'file' ||
		scheme === 'http'
	) {
		return { allowed: false, reason: 'scheme' };
	}
	if (scheme !== 'https') {
		return { allowed: false, reason: 'scheme' };
	}
	if (parsed.username || parsed.password) {
		return { allowed: false, reason: 'userinfo' };
	}
	if (parsed.port && parsed.port !== '443') {
		return { allowed: false, reason: 'port' };
	}

	const host = (parsed.hostname || '').trim().toLowerCase();
	if (!host) return { allowed: false, reason: 'host' };

	if (policy.mode === 'open') return { allowed: true, reason: 'ok' };
	if (policy.mode === 'allowlist') {
		if (policy.allow.length === 0) {
			return { allowed: false, reason: 'allowlist_miss' };
		}
		return hostMatchesAny(host, policy.allow)
			? { allowed: true, reason: 'ok' }
			: { allowed: false, reason: 'allowlist_miss' };
	}
	if (policy.mode === 'denylist') {
		// Empty deny list would otherwise allow all HTTPS — fail closed.
		if (policy.deny.length === 0) {
			return { allowed: false, reason: 'denylist_hit' };
		}
		return hostMatchesAny(host, policy.deny)
			? { allowed: false, reason: 'denylist_hit' }
			: { allowed: true, reason: 'ok' };
	}
	return { allowed: false, reason: 'missing_policy' };
}

function entryWellFormed(entry: string): boolean {
	let e = entry.trim().toLowerCase();
	if (!e || e.includes('://')) return false;
	if (e.startsWith('.')) e = e.slice(1);
	if (looksLikeCidrOrIp(e)) return true;
	if (e.includes(' ') || e.startsWith('-') || e.endsWith('-')) return false;
	return /^[a-z0-9.-]+$/i.test(e);
}

function looksLikeCidrOrIp(e: string): boolean {
	// Lightweight mirror of Python ip_network acceptance for common forms.
	const cidr = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(e);
	const v6 = e.includes(':');
	return cidr || v6;
}

function hostMatchesAny(host: string, entries: readonly string[]): boolean {
	for (const raw of entries) {
		let entry = (raw || '').trim().toLowerCase();
		if (!entry) continue;
		if (entry.startsWith('.')) entry = entry.slice(1);
		if (ipInCidr(host, entry)) return true;
		if (host === entry || host.endsWith(`.${entry}`)) return true;
	}
	return false;
}

function ipInCidr(host: string, entry: string): boolean {
	if (entry.includes(':') || host.includes(':')) {
		return ipv6InCidr(host, entry);
	}
	const m = /^(\d{1,3}\.){3}\d{1,3}(?:\/(\d{1,2}))?$/.exec(entry);
	if (!m) return false;
	const hostParts = host.split('.').map((x) => Number(x));
	if (hostParts.length !== 4 || hostParts.some((n) => !Number.isFinite(n))) {
		return false;
	}
	const [a, b, c, d] = entry
		.split('/')[0]
		.split('.')
		.map((x) => Number(x));
	const prefix = m[2] != null ? Number(m[2]) : 32;
	if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false;
	const hostNum =
		(((hostParts[0] << 24) >>> 0) +
			((hostParts[1] << 16) >>> 0) +
			((hostParts[2] << 8) >>> 0) +
			(hostParts[3] >>> 0)) >>>
		0;
	const netNum =
		(((a << 24) >>> 0) + ((b << 16) >>> 0) + ((c << 8) >>> 0) + (d >>> 0)) >>>
		0;
	const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
	return (hostNum & mask) === (netNum & mask);
}

function parseIpv6ToBigInt(raw: string): bigint | null {
	const clean = raw.trim().replace(/^\[|\]$/g, '');
	if (!clean.includes(':')) return null;
	const halves = clean.split('::');
	if (halves.length > 2) return null;
	const expand = (part: string): number[] =>
		part === ''
			? []
			: part.split(':').map((h) => Number.parseInt(h || '0', 16));
	const head = expand(halves[0] ?? '');
	const tail = halves.length === 2 ? expand(halves[1] ?? '') : [];
	if (head.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff)) return null;
	if (tail.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff)) return null;
	const missing = 8 - head.length - tail.length;
	if (missing < 0) return null;
	if (halves.length === 1 && missing !== 0) return null;
	const full = [...head, ...Array(Math.max(0, missing)).fill(0), ...tail];
	if (full.length !== 8) return null;
	let out = 0n;
	for (const n of full) {
		out = (out << 16n) + BigInt(n);
	}
	return out;
}

function ipv6InCidr(host: string, entry: string): boolean {
	const slash = entry.indexOf('/');
	const netRaw = slash >= 0 ? entry.slice(0, slash) : entry;
	const prefix = slash >= 0 ? Number(entry.slice(slash + 1)) : 128;
	if (!Number.isFinite(prefix) || prefix < 0 || prefix > 128) return false;
	if (!netRaw.includes(':')) return false;
	const hostN = parseIpv6ToBigInt(host);
	const netN = parseIpv6ToBigInt(netRaw);
	if (hostN == null || netN == null) return false;
	const mask =
		prefix === 0
			? 0n
			: prefix >= 128
				? (1n << 128n) - 1n
				: ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
	return (hostN & mask) === (netN & mask);
}
