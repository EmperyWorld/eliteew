import * as React from 'react';
import { useMemo } from 'react';

interface ProductSkeletonProps {
	viewMode: 'grid' | 'list';
	count?: number;
}

export const ProductSkeleton: React.FC<ProductSkeletonProps> = ({
	viewMode,
	count = 8,
}) => {
	const rowKeys = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => `product-skel-${viewMode}-${i}`),
		[count, viewMode]
	);

	if (viewMode === 'grid') {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{rowKeys.map((rowKey, i) => (
					<div
						key={rowKey}
						className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 overflow-hidden animate-pulse"
						style={{ animationDelay: `${i * 50}ms` }}
					>
						{/* Image skeleton */}
						<div className="aspect-square bg-gradient-to-br from-neutral-200 to-neutral-100 dark:from-slate-700 dark:to-slate-600">
							<div className="w-full h-full flex items-center justify-center">
								<div className="w-16 h-16 rounded-full bg-neutral-300 dark:bg-slate-600 animate-pulse" />
							</div>
						</div>

						{/* Content skeleton */}
						<div className="p-4 space-y-3">
							{/* Badge */}
							<div className="flex items-center justify-between">
								<div className="h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded-full" />
								<div className="h-4 w-12 bg-neutral-200 dark:bg-slate-700 rounded" />
							</div>

							{/* Title */}
							<div className="space-y-2">
								<div className="h-5 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
								<div className="h-5 w-2/3 bg-neutral-200 dark:bg-slate-700 rounded" />
							</div>

							{/* Price */}
							<div className="pt-2 border-t border-neutral-100 dark:border-slate-700">
								<div className="h-8 w-28 bg-neutral-200 dark:bg-slate-700 rounded" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	// List skeleton — mirrors ProductsListPage table (checkbox / товар / коллекция / объём / цена / статус / действия)
	return (
		<div className="overflow-hidden pb-20 rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead className="bg-neutral-50 dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-700">
						<tr>
							<th className="pl-4 py-3 w-10">
								<div className="w-5 h-5 rounded bg-neutral-200 dark:bg-slate-700 animate-pulse" />
							</th>
							<th className="text-left px-4 py-3">
								<div className="h-4 w-16 bg-neutral-200 dark:bg-slate-700 rounded animate-pulse" />
							</th>
							<th className="text-left px-4 py-3 hidden sm:table-cell">
								<div className="h-4 w-20 bg-neutral-200 dark:bg-slate-700 rounded animate-pulse" />
							</th>
							<th className="text-left px-4 py-3">
								<div className="h-4 w-14 bg-neutral-200 dark:bg-slate-700 rounded animate-pulse" />
							</th>
							<th className="text-right px-4 py-3">
								<div className="ml-auto h-4 w-12 bg-neutral-200 dark:bg-slate-700 rounded animate-pulse" />
							</th>
							<th className="text-right px-4 py-3 hidden md:table-cell">
								<div className="ml-auto h-4 w-14 bg-neutral-200 dark:bg-slate-700 rounded animate-pulse" />
							</th>
							<th className="text-right px-4 py-3 w-32">
								<div className="ml-auto h-4 w-20 bg-neutral-200 dark:bg-slate-700 rounded animate-pulse" />
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
						{rowKeys.map((rowKey, _i) => (
							<tr key={rowKey} className="animate-pulse">
								<td className="pl-4 py-3">
									<div className="w-5 h-5 rounded bg-neutral-200 dark:bg-slate-700" />
								</td>
								<td className="px-4 py-3">
									<div className="flex items-center gap-3">
										<div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-slate-700 shrink-0" />
										<div className="space-y-2 min-w-0 flex-1">
											<div className="h-4 max-w-[12rem] bg-neutral-200 dark:bg-slate-700 rounded" />
											<div className="h-3 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
										</div>
									</div>
								</td>
								<td className="px-4 py-3 hidden sm:table-cell">
									<div className="h-6 w-28 bg-neutral-200 dark:bg-slate-700 rounded-full" />
								</td>
								<td className="px-4 py-3">
									<div className="h-4 w-14 bg-neutral-200 dark:bg-slate-700 rounded" />
								</td>
								<td className="px-4 py-3 text-right">
									<div className="inline-block h-5 w-20 bg-neutral-200 dark:bg-slate-700 rounded" />
								</td>
								<td className="px-4 py-3 text-right hidden md:table-cell">
									<div className="inline-block h-6 w-24 bg-neutral-200 dark:bg-slate-700 rounded-full" />
								</td>
								<td className="px-4 py-3 text-right">
									<div className="flex justify-end gap-1">
										<div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-slate-700" />
										<div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-slate-700" />
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};
