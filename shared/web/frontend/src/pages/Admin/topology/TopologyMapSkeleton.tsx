/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loading placeholder for Admin Topology Map canvas.
 *
 * Related:
 * - TopologyAdminSection.tsx
 */

export function TopologyMapSkeleton(): React.ReactElement {
	return (
		<div
			className="relative h-[min(72vh,680px)] min-h-[500px] w-full overflow-hidden rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]"
			aria-hidden
		>
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:20px_20px]" />
			<div className="flex h-full flex-col items-center justify-center gap-4 p-8">
				<div className="grid w-full max-w-2xl grid-cols-3 gap-4">
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<div
							key={i}
							className="h-20 animate-pulse rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)]/50 bg-[var(--admin-ui-surface-strong)]/40"
							style={{ animationDelay: `${i * 80}ms` }}
						/>
					))}
				</div>
				<div className="h-3 w-48 animate-pulse rounded-full bg-[var(--admin-ui-border)]/60" />
			</div>
		</div>
	);
}
