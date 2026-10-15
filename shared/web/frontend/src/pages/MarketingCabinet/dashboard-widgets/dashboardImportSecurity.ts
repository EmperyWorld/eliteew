/**
 * Strip absolute http(s) URLs from imported/clipboard JSON (marketing dashboard).
 * Preserves `canvasMarkdown` blobs so links in notes stay intact.
 *
 * Host allowlist (comma-separated hostnames, case-insensitive), parity with API
 * `MARKETING_DASHBOARD_WIDGET_CONFIG_URL_ALLOWLIST` / `dashboard_widget_config.py`:
 * - Prefer `import.meta.env.VITE_MARKETING_DASHBOARD_WIDGET_CONFIG_URL_ALLOWLIST`
 * - Else `import.meta.env.VITE_MARKETING_DASHBOARD_URL_ALLOWLIST` (legacy Vite name)
 */

const DEFAULT_MAX_DEPTH = 14;

/** Comma-separated hosts → lowercase set (used by tests and build-time env parsing). */
export function marketingDashboardUrlAllowHostsFromCommaList(
	raw: string | undefined
): Set<string> {
	if (typeof raw !== 'string' || !raw.trim()) {
		return new Set();
	}
	return new Set(
		raw
			.split(',')
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
	);
}

function parseAllowHosts(): Set<string> {
	const canonical = import.meta.env
		.VITE_MARKETING_DASHBOARD_WIDGET_CONFIG_URL_ALLOWLIST;
	const legacy = import.meta.env.VITE_MARKETING_DASHBOARD_URL_ALLOWLIST;
	const raw =
		typeof canonical === 'string' && canonical.trim()
			? canonical
			: typeof legacy === 'string' && legacy.trim()
				? legacy
				: undefined;
	return marketingDashboardUrlAllowHostsFromCommaList(raw);
}

function hostnameAllowed(host: string | null, allow: Set<string>): boolean {
	if (!host) {
		return false;
	}
	const h = host.toLowerCase();
	if (allow.size === 0) {
		return false;
	}
	return allow.has(h);
}

/** If string is only an absolute http(s) URL, strip when host not allowlisted. */
export function stripExternalHttpUrlString(
	s: string,
	allowHosts: Set<string> = parseAllowHosts()
): string {
	const t = s.trim();
	if (!/^https?:\/\//i.test(t)) {
		return s;
	}
	try {
		const u = new URL(t);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') {
			return s;
		}
		if (hostnameAllowed(u.hostname, allowHosts)) {
			return s;
		}
		return '';
	} catch {
		return '';
	}
}

export function stripExternalHttpUrlsFromJsonValue(
	value: unknown,
	allowHosts: Set<string> = parseAllowHosts(),
	parentKey: string | null = null,
	depth = 0
): unknown {
	if (depth > DEFAULT_MAX_DEPTH) {
		return value;
	}
	if (parentKey === 'canvasMarkdown' && typeof value === 'string') {
		return value;
	}
	if (typeof value === 'string') {
		return stripExternalHttpUrlString(value, allowHosts);
	}
	if (value === null || typeof value !== 'object') {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((x) =>
			stripExternalHttpUrlsFromJsonValue(x, allowHosts, parentKey, depth + 1)
		);
	}
	const o = value as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(o)) {
		if (k === 'canvasMarkdown' && typeof v === 'string') {
			out[k] = v;
			continue;
		}
		out[k] = stripExternalHttpUrlsFromJsonValue(v, allowHosts, k, depth + 1);
	}
	return out;
}
