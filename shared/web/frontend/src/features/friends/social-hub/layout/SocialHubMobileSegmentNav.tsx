/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Horizontal segment navigation for Social Hub embedded mobile shell (touch-first).
 *
 * Invariants:
 * - Radix Toggle Group single-select; always one active section.
 *
 * Related:
 * - SocialHubShell.tsx, socialHubNavigation.ts
 */

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
	DevicePhoneMobileIcon,
	HomeIcon,
	ShieldCheckIcon,
	UserGroupIcon,
} from '@heroicons/react/24/outline';

import {
	MOBILE_EMBEDDED_SEGMENT_RAIL_CLASS,
	mobileEmbeddedSegmentItemClass,
} from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { cn } from '@/utils/cn';

import type { SocialHubSection } from '../socialHubNavigation';
import type { SocialHubSidebarNavItem } from './SocialHubSidebarNav';

function sectionIcon(section: SocialHubSection) {
	switch (section) {
		case 'home':
			return HomeIcon;
		case 'people':
			return UserGroupIcon;
		case 'privacy':
			return ShieldCheckIcon;
		case 'phone':
			return DevicePhoneMobileIcon;
	}
}

export function SocialHubMobileSegmentNav({
	activeSection,
	navItems,
	ariaLabel,
	onSelectSection,
}: {
	activeSection: SocialHubSection;
	navItems: SocialHubSidebarNavItem[];
	ariaLabel: string;
	onSelectSection: (section: SocialHubSection) => void;
}): JSX.Element {
	return (
		<ToggleGroup.Root
			type="single"
			value={activeSection}
			onValueChange={(value) => {
				if (
					value === 'home' ||
					value === 'people' ||
					value === 'privacy' ||
					value === 'phone'
				) {
					onSelectSection(value);
				}
			}}
			className={MOBILE_EMBEDDED_SEGMENT_RAIL_CLASS}
			aria-label={ariaLabel}
		>
			{navItems.map((item) => {
				const Icon = sectionIcon(item.id);
				const active = item.id === activeSection;
				return (
					<ToggleGroup.Item
						key={item.id}
						value={item.id}
						aria-current={active ? 'page' : undefined}
						className={cn(
							mobileEmbeddedSegmentItemClass(active),
							'data-[state=on]:bg-[rgb(var(--desktop-accent-rgb))]/14 data-[state=on]:text-(--desktop-text-primary)'
						)}
					>
						<Icon className="h-4 w-4 shrink-0" aria-hidden strokeWidth={1.75} />
						<span className="max-w-18 truncate">{item.label}</span>
						{item.badgeCount && item.badgeCount > 0 ? (
							<span
								className="min-w-4 rounded-full bg-[rgb(var(--desktop-accent-rgb))]/25 px-1 text-[10px] font-bold tabular-nums"
								aria-hidden
							>
								{item.badgeCount > 99 ? '99+' : item.badgeCount}
							</span>
						) : null}
					</ToggleGroup.Item>
				);
			})}
		</ToggleGroup.Root>
	);
}
