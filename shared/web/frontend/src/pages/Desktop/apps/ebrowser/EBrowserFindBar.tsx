/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EBrowser find-in-page bar (WebKit FindController via IPC).
 *
 * Related:
 * - features/ebrowser/ebrowserNative.ts
 */

import { cn } from '@/utils/cn';
import {
	ChevronDownIcon,
	ChevronUpIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { ReactElement, RefObject } from 'react';
import {
	DesktopAppButton,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

export function EBrowserFindBar(props: {
	query: string;
	onQueryChange: (v: string) => void;
	onSubmit: () => void;
	onNext: () => void;
	onPrev: () => void;
	onClose: () => void;
	inputRef: RefObject<HTMLInputElement | null>;
	labels: {
		label: string;
		placeholder: string;
		next: string;
		prev: string;
		close: string;
	};
}): ReactElement {
	const { labels } = props;
	return (
		<form
			className="flex shrink-0 items-center gap-1.5 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-2 py-1.5"
			aria-label={labels.label}
			onSubmit={(e) => {
				e.preventDefault();
				props.onSubmit();
			}}
		>
			<MagnifyingGlassIcon
				className="h-4 w-4 shrink-0 text-(--desktop-text-secondary)"
				aria-hidden
			/>
			<DesktopAppInput
				ref={props.inputRef}
				type="search"
				value={props.query}
				onChange={(e) => props.onQueryChange(e.target.value)}
				placeholder={labels.placeholder}
				className="min-w-0 flex-1"
				autoComplete="off"
				maxLength={200}
			/>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="icon"
				aria-label={labels.prev}
				onClick={props.onPrev}
				className="h-8 w-8 min-h-8 min-w-8"
			>
				<ChevronUpIcon className="h-4 w-4" aria-hidden />
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="icon"
				aria-label={labels.next}
				onClick={props.onNext}
				className="h-8 w-8 min-h-8 min-w-8"
			>
				<ChevronDownIcon className="h-4 w-4" aria-hidden />
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="icon"
				aria-label={labels.close}
				onClick={props.onClose}
				className={cn(
					'h-8 w-8 min-h-8 min-w-8',
					DESKTOP_TYPOGRAPHY.captionInherit
				)}
			>
				<XMarkIcon className="h-4 w-4" aria-hidden />
			</DesktopAppButton>
		</form>
	);
}
