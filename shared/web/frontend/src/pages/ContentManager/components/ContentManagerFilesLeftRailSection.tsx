/**
 * Секция левой колонки контент-менеджера (desktop, вкладка «Файлы»).
 */
import * as React from 'react';
import { cn } from '@/utils/cn';
import { DESKTOP_APP_STYLE_CONTRACT } from '../../Desktop/components/DesktopAppChrome';

export type ContentManagerFilesLeftRailSectionProps = {
	/** Подпись группы (капс, как в desktop chrome). */
	title?: string;
	children: React.ReactNode;
	className?: string;
};

export function ContentManagerFilesLeftRailSection({
	title,
	children,
	className,
}: ContentManagerFilesLeftRailSectionProps): React.ReactElement {
	return (
		<div className={cn('min-w-0 py-3 first:pt-1.5 last:pb-1', className)}>
			{title ? (
				<h2
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
						'mb-2.5 block px-0.5'
					)}
				>
					{title}
				</h2>
			) : null}
			<div className="min-w-0">{children}</div>
		</div>
	);
}
