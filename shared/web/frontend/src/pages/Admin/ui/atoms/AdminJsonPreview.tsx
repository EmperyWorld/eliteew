/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Collapsible JSON preview for Admin New World drilldowns.
 * Invariants: Presentational only; no Old World chrome imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useState } from 'react';

import { AdminButton } from './AdminButton';

export type AdminJsonPreviewProps = {
	value: unknown;
	title?: string;
	helper?: string;
	defaultCollapsed?: boolean;
};

export function AdminJsonPreview({
	value,
	title,
	helper,
	defaultCollapsed = false,
}: AdminJsonPreviewProps) {
	const [copied, setCopied] = useState(false);
	const text = JSON.stringify(value, null, 2);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	}

	return (
		<details
			className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-3"
			open={!defaultCollapsed}
		>
			<summary className="cursor-pointer text-sm font-medium text-[var(--admin-ui-fg)]">
				{title ?? 'JSON'}
			</summary>
			{helper ? (
				<p className="mt-2 text-xs text-[var(--admin-ui-fg-muted)]">{helper}</p>
			) : null}
			<div className="mt-2 flex justify-end">
				<AdminButton variant="ghost" onClick={() => void handleCopy()}>
					{copied ? 'Copied' : 'Copy'}
				</AdminButton>
			</div>
			<pre className="mt-2 max-h-80 overflow-auto rounded-[var(--admin-ui-radius-sm)] bg-black/30 p-3 text-xs text-[var(--admin-ui-fg)]">
				{text}
			</pre>
		</details>
	);
}
