import { ADMIN_ROUTES } from '@constants/adminRoutes';
import {
	AcademicCapIcon,
	AdjustmentsHorizontalIcon,
	ArrowTrendingUpIcon,
	CalendarIcon,
	ChatBubbleLeftRightIcon,
	Cog6ToothIcon,
	CubeIcon,
	DocumentTextIcon,
	PhotoIcon,
	PresentationChartBarIcon,
	RectangleStackIcon,
	ShoppingBagIcon,
	ShoppingCartIcon,
	SparklesIcon,
	Squares2X2Icon,
	SwatchIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
/** i18n: `siteStudio` → `adminChrome.nav.${titleKey|labelKey}` */
export interface NavItem {
	to: string;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	/** e.g. `items.dashboard` → `adminChrome.nav.items.dashboard` */
	labelKey: string;
	exact?: boolean;
	badge?: boolean;
	color?: string;
}

export interface NavGroup {
	id: string;
	/** e.g. `groups.overview` → `adminChrome.nav.groups.overview` */
	titleKey: string;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	items: NavItem[];
	color?: string;
}

export const navGroups: NavGroup[] = [
	{
		id: 'overview',
		titleKey: 'groups.overview',
		icon: ArrowTrendingUpIcon,
		color: 'text-emerald-500',
		items: [
			{
				to: ADMIN_ROUTES.DASHBOARD,
				icon: Squares2X2Icon,
				labelKey: 'items.dashboard',
				exact: true,
				color: 'emerald',
			},
		],
	},
	{
		id: 'sales',
		titleKey: 'groups.sales',
		icon: ShoppingBagIcon,
		color: 'text-orange-500',
		items: [
			{
				to: ADMIN_ROUTES.ORDERS,
				icon: ShoppingCartIcon,
				labelKey: 'items.orders',
				badge: true,
				color: 'orange',
			},
			{
				to: ADMIN_ROUTES.BOOKINGS,
				icon: UsersIcon,
				labelKey: 'items.bookings',
				badge: true,
				color: 'purple',
			},
			{
				to: ADMIN_ROUTES.SCHEDULE,
				icon: CalendarIcon,
				labelKey: 'items.schedule',
				color: 'blue',
			},
		],
	},
	{
		id: 'catalog',
		titleKey: 'groups.catalog',
		icon: RectangleStackIcon,
		color: 'text-blue-500',
		items: [
			{
				to: ADMIN_ROUTES.PRODUCTS,
				icon: CubeIcon,
				labelKey: 'items.products',
				color: 'primary',
			},
			{
				to: ADMIN_ROUTES.CONSULTATIONS,
				icon: ChatBubbleLeftRightIcon,
				labelKey: 'items.consultations',
				color: 'purple',
			},
			{
				to: ADMIN_ROUTES.MASTERCLASSES,
				icon: AcademicCapIcon,
				labelKey: 'items.masterclasses',
				color: 'blue',
			},
		],
	},
	{
		id: 'content',
		titleKey: 'groups.content',
		icon: SparklesIcon,
		color: 'text-pink-500',
		items: [
			{
				to: ADMIN_ROUTES.GALLERY,
				icon: PhotoIcon,
				labelKey: 'items.gallery',
				color: 'pink',
			},
			{
				to: ADMIN_ROUTES.CONTENT,
				icon: DocumentTextIcon,
				labelKey: 'items.contentPage',
				color: 'amber',
			},
			{
				to: ADMIN_ROUTES.PRESENTATIONS,
				icon: PresentationChartBarIcon,
				labelKey: 'items.presentations',
				color: 'blue',
			},
			{
				to: ADMIN_ROUTES.CUSTOMIZATION,
				icon: SwatchIcon,
				labelKey: 'items.customization',
				color: 'violet',
			},
		],
	},
	{
		id: 'system',
		titleKey: 'groups.system',
		icon: Cog6ToothIcon,
		color: 'text-neutral-500',
		items: [
			{
				to: ADMIN_ROUTES.SETTINGS,
				icon: Cog6ToothIcon,
				labelKey: 'items.settings',
				color: 'neutral',
			},
			{
				to: ADMIN_ROUTES.CONFIG,
				icon: AdjustmentsHorizontalIcon,
				labelKey: 'items.config',
				color: 'neutral',
			},
		],
	},
];

/** Flat list for header title resolution */
export const navItems = navGroups.flatMap((group) => group.items);
