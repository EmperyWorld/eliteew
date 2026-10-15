/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sized mount for Recharts ResponsiveContainer — avoids width/height -1 when flex layout is not ready.
 *
 * Invariants:
 * - Chart children mount only after the box reports positive width and height.
 *
 * Related:
 * - MarketingPerformanceChartFrame.tsx, CustomerDiagnosticCharts.tsx
 */
import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

import { cn } from '@/utils/cn';

const DEFAULT_MIN_HEIGHT_PX = 224;

export function RechartsSizedFrame({
	children,
	className,
	minHeight = DEFAULT_MIN_HEIGHT_PX,
	ariaLabel,
}: {
	children: ReactElement;
	className?: string;
	minHeight?: number;
	ariaLabel?: string;
}) {
	const boxRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);

	useLayoutEffect(() => {
		const el = boxRef.current;
		if (!el) return;

		const update = () => {
			const { width, height } = el.getBoundingClientRect();
			const visible =
				el.offsetParent !== null || el.getClientRects().length > 0;
			setReady(visible && width > 8 && height > 8);
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		window.addEventListener('resize', update);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', update);
		};
	}, []);

	return (
		<div
			ref={boxRef}
			className={cn('min-w-0 w-full', className)}
			{...(ariaLabel
				? ({ role: 'img' as const, 'aria-label': ariaLabel } as const)
				: {})}
		>
			{ready ? (
				<ResponsiveContainer width="100%" height="100%" minHeight={minHeight}>
					{children}
				</ResponsiveContainer>
			) : (
				<div
					className="h-full w-full rounded-(--desktop-radius) bg-(--desktop-surface-soft)/30"
					aria-hidden
				/>
			)}
		</div>
	);
}
