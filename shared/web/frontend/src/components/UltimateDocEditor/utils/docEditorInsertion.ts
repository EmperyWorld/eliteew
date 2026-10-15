/** Абсолютный URL для img/TipTap: относительные /api/... иначе не грузятся в превью */
export function resolveMediaUrlForEditor(url: string): string {
	const t = url.trim();
	if (!t) {
		return t;
	}
	if (
		t.startsWith('data:') ||
		t.startsWith('blob:') ||
		t.startsWith('http://') ||
		t.startsWith('https://')
	) {
		return t;
	}
	if (typeof window !== 'undefined') {
		if (t.startsWith('/') && !t.startsWith('//')) {
			return `${window.location.origin}${t}`;
		}
		if (t.startsWith('//')) {
			return `${window.location.protocol}${t}`;
		}
	}
	return t;
}

export function sanitizeInsertionHtml(html: string): string {
	if (!html) {
		return '';
	}
	return (
		html
			.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
			.replace(/on\w+="[^"]*"/gi, '')
			.replace(/on\w+='[^']*'/gi, '')
			// Только пустой src="" / src=''
			.replace(/<img([^>]*?)\ssrc=(["'])\s*\2/gi, '<img$1')
	);
}
