import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopAppSurface } from '../../Desktop/components/DesktopAppChrome';

export function MarketingCabinetShell({ children }: { children: ReactNode }) {
	const { t } = useTranslation('marketing');
	return (
		<DesktopAppSurface
			variant="shell"
			data-marketing-cabinet-shell
			data-desktop-window-ignore-context
			className="relative isolate flex h-full min-h-0 w-full overflow-hidden"
		>
			<a
				href="#marketing-cabinet-main"
				className="absolute left-[-9999px] z-60 rounded bg-(--desktop-surface-accent) px-4 py-2 text-sm text-(--desktop-text-primary) outline-none ring-2 ring-(--mc-accent) focus:fixed focus:left-4 focus:top-4 focus:inline-block focus:no-underline"
			>
				{t('skipToContent')}
			</a>
			{children}
		</DesktopAppSurface>
	);
}
