import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';

export function renderMarkdownToHTML(markdown: string): string {
	const source = markdown.trim();
	if (!source) {
		return '<p></p>';
	}

	const rendered = renderToStaticMarkup(
		createElement(
			ReactMarkdown,
			{
				remarkPlugins: [remarkGfm],
				rehypePlugins: [rehypeRaw],
			},
			source
		)
	);

	return sanitizeUserHtml(rendered);
}
