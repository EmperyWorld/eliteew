/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Touch pull-to-refresh hook for mobile embedded companion transcript (U5.5).
 *
 * Invariants:
 * - Disabled when `enabled` is false or a refresh is already in flight.
 * - Uses non-passive touchmove only on the bound scroll container.
 *
 * Related:
 * - src/features/ewa/companionUx/companionMobilePullRefresh.ts
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
	type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
	companionMobilePullRefreshHint,
	companionMobilePullRefreshOffset,
	isCompanionMobilePullScrollAtTop,
	shouldTriggerCompanionMobilePullRefresh,
} from '@/features/ewa/companionUx/companionMobilePullRefresh';
import { cn } from '@/utils/cn';

export type UseCompanionMobilePullRefreshOptions = {
	enabled: boolean;
	onRefresh: () => Promise<void>;
	reducedMotion?: boolean;
};

export type UseCompanionMobilePullRefreshResult = {
	scrollRef: Ref<HTMLDivElement>;
	pullIndicator: ReactNode;
	refreshing: boolean;
};

export function useCompanionMobilePullRefresh({
	enabled,
	onRefresh,
	reducedMotion = false,
}: UseCompanionMobilePullRefreshOptions): UseCompanionMobilePullRefreshResult {
	const { t } = useTranslation('marketing');
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [pullPx, setPullPx] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const pullPxRef = useRef(0);
	const refreshingRef = useRef(false);
	const onRefreshRef = useRef(onRefresh);

	useEffect(() => {
		onRefreshRef.current = onRefresh;
	}, [onRefresh]);

	useEffect(() => {
		refreshingRef.current = refreshing;
	}, [refreshing]);

	useEffect(() => {
		pullPxRef.current = pullPx;
	}, [pullPx]);

	const runRefresh = useCallback(async () => {
		if (refreshingRef.current) return;
		setRefreshing(true);
		try {
			await onRefreshRef.current();
		} finally {
			setRefreshing(false);
			setPullPx(0);
		}
	}, []);

	useEffect(() => {
		if (!enabled) {
			setPullPx(0);
			return;
		}
		const el = scrollRef.current;
		if (!el) return;

		let touchStartY = 0;
		let pulling = false;

		const onTouchStart = (event: TouchEvent) => {
			if (
				refreshingRef.current ||
				!isCompanionMobilePullScrollAtTop(el.scrollTop)
			) {
				return;
			}
			touchStartY = event.touches[0]?.clientY ?? 0;
			pulling = true;
		};

		const onTouchMove = (event: TouchEvent) => {
			if (!pulling || refreshingRef.current) return;
			if (!isCompanionMobilePullScrollAtTop(el.scrollTop)) {
				setPullPx(0);
				return;
			}
			const deltaY = (event.touches[0]?.clientY ?? 0) - touchStartY;
			const offset = companionMobilePullRefreshOffset(
				deltaY,
				el.scrollTop,
				true
			);
			setPullPx(offset);
			if (offset > 6) {
				event.preventDefault();
			}
		};

		const onTouchEnd = () => {
			if (!pulling) return;
			pulling = false;
			const shouldRefresh = shouldTriggerCompanionMobilePullRefresh(
				pullPxRef.current
			);
			if (shouldRefresh) {
				void runRefresh();
				return;
			}
			setPullPx(0);
		};

		const onTouchCancel = () => {
			pulling = false;
			setPullPx(0);
		};

		el.addEventListener('touchstart', onTouchStart, { passive: true });
		el.addEventListener('touchmove', onTouchMove, { passive: false });
		el.addEventListener('touchend', onTouchEnd, { passive: true });
		el.addEventListener('touchcancel', onTouchCancel, { passive: true });

		return () => {
			el.removeEventListener('touchstart', onTouchStart);
			el.removeEventListener('touchmove', onTouchMove);
			el.removeEventListener('touchend', onTouchEnd);
			el.removeEventListener('touchcancel', onTouchCancel);
		};
	}, [enabled, runRefresh]);

	const hint = companionMobilePullRefreshHint(pullPx, refreshing);
	const visible = enabled && (pullPx > 0 || refreshing);

	const pullIndicator = visible ? (
		<div
			className="pointer-events-none sticky top-0 z-20 flex justify-center"
			style={{
				height: refreshing ? 36 : Math.max(28, pullPx),
				marginBottom: refreshing ? 0 : -Math.max(0, pullPx - 28),
			}}
			aria-hidden={hint === 'idle'}
			data-testid="ewa-companion-mobile-pull-refresh"
			data-pull-state={hint}
		>
			<div
				className={cn(
					'inline-flex items-center gap-1.5 rounded-full border border-white/12',
					'bg-black/35 px-2.5 py-1 text-[11px] font-medium text-(--companion-text-soft)',
					'backdrop-blur-sm'
				)}
			>
				<ArrowPathIcon
					className={cn(
						'size-3.5',
						(hint === 'refreshing' || hint === 'release') &&
							!reducedMotion &&
							'motion-safe:animate-spin'
					)}
					aria-hidden
				/>
				<span>
					{hint === 'refreshing'
						? t('ewaCompanion.mobilePullRefreshing')
						: hint === 'release'
							? t('ewaCompanion.mobilePullRelease')
							: t('ewaCompanion.mobilePullHint')}
				</span>
			</div>
		</div>
	) : null;

	return {
		scrollRef,
		pullIndicator,
		refreshing,
	};
}
