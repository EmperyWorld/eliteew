import type { AnyExtension } from '@tiptap/core';
import CodeBlock from '@tiptap/extension-code-block';
import Mathematics from '@tiptap/extension-mathematics';

import 'katex/dist/katex.min.css';
import 'tippy.js/dist/tippy.css';

import { SlashCommand } from '../components/SlashCommands';

export function createOptionalTiptapExtensions(): AnyExtension[] {
	return [
		CodeBlock.configure({
			HTMLAttributes: {
				class: 'code-block',
			},
		}),
		Mathematics.configure({
			katexOptions: {
				throwOnError: false,
			},
		}),
		SlashCommand,
	];
}
