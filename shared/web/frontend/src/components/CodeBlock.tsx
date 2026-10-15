/**
 * Code block for assistant/chat markdown: monospace body, optional line numbers.
 * Syntax highlighting removed (react-syntax-highlighter) to avoid hundreds of lazy language chunks.
 */

import { type FC, useMemo } from 'react';

interface CodeBlockProps {
	language?: string;
	code: string;
	showLineNumbers?: boolean;
	className?: string;
	themeVariant?: 'default' | 'desktop-chat';
}

function splitLines(raw: string): string[] {
	const normalized = raw.replace(/\n$/, '');
	if (!normalized) {
		return [''];
	}
	return normalized.split('\n');
}

export const CodeBlock: FC<CodeBlockProps> = ({
	language: _language = 'typescript',
	code,
	showLineNumbers = true,
	className = '',
	themeVariant = 'default',
}) => {
	const lines = useMemo(() => splitLines(code), [code]);

	const shellClass =
		themeVariant === 'desktop-chat'
			? 'm-0 overflow-x-auto bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.96)_100%)] p-3.5 text-[0.875rem] leading-[1.6] text-slate-200'
			: 'm-0 overflow-x-auto bg-slate-950/90 p-3.5 text-[0.875rem] leading-[1.6] text-slate-200';

	const radiusClass =
		themeVariant === 'desktop-chat' ? 'rounded-none' : 'rounded-lg';

	const codeFont =
		'font-[family-name:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace] whitespace-pre [overflow-wrap:normal]';

	return (
		<div className={`flex min-w-0 gap-0 ${radiusClass} ${className}`.trim()}>
			{showLineNumbers ? (
				<div
					className={`shrink-0 select-none border-r border-white/10 py-3.5 pr-3 pl-3 text-right text-[0.75rem] leading-[1.6] text-slate-500 tabular-nums ${radiusClass} rounded-r-none`}
					aria-hidden
				>
					{lines.map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: line numbers are stable for this static list
						<div key={`ln-${i + 1}`}>{i + 1}</div>
					))}
				</div>
			) : null}
			<pre
				className={`${shellClass} min-w-0 flex-1 ${showLineNumbers ? 'rounded-l-none pl-3' : ''} ${radiusClass}`}
			>
				<code className={codeFont}>{code.replace(/\n$/, '')}</code>
			</pre>
		</div>
	);
};

export default CodeBlock;
