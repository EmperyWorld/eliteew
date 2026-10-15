/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query / Mutation host shapes for MarketingCabinet compose bags
 * and ViewRouter → section prop seams (Cause A — not `unknown` erasure).
 *
 * Invariants:
 * - Property access on hosts is typed; concrete UseQueryResult/UseMutationResult
 *   remain assignable into these hosts.
 * - No `@ts-expect-error` / `as any` / `as unknown as` at this seam.
 *
 * Related:
 * - marketingCabinetPageViewRouterContext.ts
 * - buildMarketingCabinetPageBags.ts
 * - .cursor/rules/frontend-ts-hygiene.mdc
 */

/** React Query–shaped host used at cabinet compose / ViewRouter boundaries. */
export type QueryLike<TData = unknown> = {
	data?: TData;
	isLoading: boolean;
	isError: boolean;
	isFetching?: boolean;
	isSuccess?: boolean;
	error: { message?: string } | Error | null;
	refetch: () => unknown;
	status?: string;
	fetchNextPage?: () => unknown;
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
};

/**
 * Mutation host — bivariant `mutate` / `mutateAsync` (React EventHandler pattern)
 * so concrete UseMutationResult assigns without silence casts.
 */
export type MutationLike = {
	isPending: boolean;
	isError?: boolean;
	isSuccess?: boolean;
	error?: { message?: string } | Error | null;
	data?: unknown;
	/** RQ variables — void | string | object depending on mutate arity */
	// biome-ignore lint/suspicious/noExplicitAny: compose/section mutation seam — host for RQ variables
	variables?: any;
	// biome-ignore lint/suspicious/noExplicitAny: compose/section mutation seam — bivariant host
	mutate: (...args: any[]) => any;
	// biome-ignore lint/suspicious/noExplicitAny: compose/section mutation seam — bivariant host
	mutateAsync: (...args: any[]) => any;
	reset: () => void;
	status?: string;
};
