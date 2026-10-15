/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build display names for Content Manager file copies (auto prefix + collision suffix).
 *
 * Invariants:
 * - Prefix is supplied by i18n; this module only concatenates and deduplicates within a batch.
 *
 * Related:
 * - src/pages/ContentManager/components/ContentManagerCopyModal.tsx
 */
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { contentManagerDisplayLabel } from './contentManagerTextLike';

export function buildPrefixedCopyName(
	displayName: string,
	prefix: string
): string {
	const base = displayName.trim() || 'file';
	const normalizedPrefix = prefix.replace(/^\s+/, '');
	if (!normalizedPrefix) {
		return base;
	}
	if (base.startsWith(normalizedPrefix)) {
		return base;
	}
	return `${normalizedPrefix}${base}`;
}

export function buildCopyNameForItem(
	item: Pick<ContentItem, 'name' | 'title'>,
	prefix: string,
	reservedNames: ReadonlySet<string>
): string {
	const initial = buildPrefixedCopyName(
		contentManagerDisplayLabel(item),
		prefix
	);
	return ensureUniqueCopyName(initial, reservedNames);
}

export function ensureUniqueCopyName(
	candidate: string,
	reservedNames: ReadonlySet<string>
): string {
	const base = candidate.trim() || 'file';
	if (!reservedNames.has(base)) {
		return base;
	}

	const extMatch = /^(.+)(\.[^./\\]+)$/.exec(base);
	if (extMatch) {
		const stem = extMatch[1];
		const ext = extMatch[2];
		let index = 2;
		while (reservedNames.has(`${stem}_${index}${ext}`)) {
			index += 1;
		}
		return `${stem}_${index}${ext}`;
	}

	let index = 2;
	while (reservedNames.has(`${base}_${index}`)) {
		index += 1;
	}
	return `${base}_${index}`;
}
