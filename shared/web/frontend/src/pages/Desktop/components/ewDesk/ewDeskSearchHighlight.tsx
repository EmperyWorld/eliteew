/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Highlight EWDesk feed search terms inside list row titles (client-side, case-insensitive).
 *
 * Invariants:
 * - Empty query returns plain text; regex metacharacters in query are escaped.
 *
 * Related:
 * - EwDeskNewsListRow.tsx, EWDeskApp.tsx
 */

import * as React from 'react';

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split visible text into spans with matched query tokens emphasized. */
export function highlightEwDeskSearchText(
	text: string,
	query: string
): React.ReactNode {
	const trimmed = query.trim();
	if (!trimmed) return text;
	const terms = trimmed
		.split(/\s+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.map(escapeRegExp);
	if (terms.length === 0) return text;
	const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
	const parts = text.split(pattern);
	if (parts.length <= 1) return text;
	return parts.map((part, index) => {
		if (!part) return null;
		const partKey = `${part}-${index}`;
		if (index % 2 === 1) {
			return (
				<mark
					key={partKey}
					className="rounded-sm bg-[rgb(var(--desktop-accent-rgb)/0.22)] px-0.5 text-inherit"
				>
					{part}
				</mark>
			);
		}
		return <React.Fragment key={partKey}>{part}</React.Fragment>;
	});
}
