/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Builds the shared rehype plugin pipeline for assistant markdown surfaces
 * (Desktop AI Chat and GAF assistant bubbles) with mandatory sanitize at the end.
 *
 * Invariants:
 * - `rehype-sanitize` is always appended after feature-specific rehype plugins.
 * - Heading anchor styling/a11y attrs and safe link attrs (`target`, `rel`) survive sanitize.
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiChatMarkdown.tsx
 * - src/components/assistantMessage/AssistantMessageRenderer.tsx
 */
import type { ComponentProps } from 'react';
import type ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

type ChatRehypePlugins = NonNullable<
	ComponentProps<typeof ReactMarkdown>['rehypePlugins']
>;

const sharedChatSanitizeSchema: typeof defaultSchema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		a: [
			...(defaultSchema.attributes?.a ?? []),
			'target',
			'rel',
			'className',
			'ariaLabel',
		],
		span: [...(defaultSchema.attributes?.span ?? []), 'className'],
	},
};

export function buildSharedChatRehypePlugins(
	extra: ChatRehypePlugins = []
): ChatRehypePlugins {
	return [...extra, [rehypeSanitize, sharedChatSanitizeSchema]];
}
