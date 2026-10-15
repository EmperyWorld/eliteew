/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize Stack4/Tika HTML before TipTap setContent (body fragment, real <br>).
 *
 * Invariants:
 * - Full XHTML documents are reduced to body inner HTML; sanitizeUserHtml runs after this.
 *
 * Related:
 * - api/services/stack4/document_gateway.clean_tika_html
 * - hooks/useDocumentFileExchange.ts
 */

/** TipTap-friendly fragment from Tika or legacy text→HTML conversion. */
export function prepareOfficeHtmlForTipTap(html: string): string {
	let raw = (html ?? '').trim();
	if (!raw) {
		return '<p></p>';
	}

	const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
	if (bodyMatch?.[1]) {
		raw = bodyMatch[1];
	}

	raw = raw.replace(/<style[\s\S]*?<\/style>/gi, '');
	raw = raw.replace(/<script[\s\S]*?<\/script>/gi, '');
	raw = raw.replace(/<meta[^>]*>/gi, '');
	raw = raw.replace(/&lt;br\s*\/?&gt;/gi, '<br />');
	raw = raw.replace(/<p>\s*<\/p>/gi, '');

	const trimmed = raw.trim();
	return trimmed || '<p></p>';
}
