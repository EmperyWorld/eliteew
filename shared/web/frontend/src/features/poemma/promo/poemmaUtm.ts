/**
 * UTM URL builder for /promo/utm (P-506).
 */

export type PoemmaUtmParams = {
	baseUrl: string;
	utmSource: string;
	utmMedium?: string;
	utmCampaign: string;
	utmContent?: string;
};

function trimParam(value: string): string {
	return value.trim();
}

export function buildPoemmaUtmUrl(params: PoemmaUtmParams): string | null {
	const baseUrl = trimParam(params.baseUrl);
	const utmSource = trimParam(params.utmSource);
	const utmCampaign = trimParam(params.utmCampaign);
	if (!baseUrl || !utmSource || !utmCampaign) {
		return null;
	}

	let url: URL;
	try {
		url = new URL(baseUrl.includes('://') ? baseUrl : `https://${baseUrl}`);
	} catch {
		return null;
	}

	url.searchParams.set('utm_source', utmSource);
	url.searchParams.set('utm_campaign', utmCampaign);

	const utmMedium = trimParam(params.utmMedium ?? '');
	if (utmMedium) {
		url.searchParams.set('utm_medium', utmMedium);
	}

	const utmContent = trimParam(params.utmContent ?? '');
	if (utmContent) {
		url.searchParams.set('utm_content', utmContent);
	}

	return url.toString();
}
