import { ADMIN_ROUTES } from '@constants/adminRoutes';
import * as React from 'react';
import {
	Navigate,
	type NavigateOptions,
	type NavigateProps,
	type To,
	resolvePath,
	useNavigate,
	useSearchParams,
} from 'react-router';
import { useIsDesktopEmbeddedAdmin } from './AdminShellModeContext';

type EmbeddedAdminLocation = {
	pathname: string;
	search: string;
	hash: string;
	state: unknown;
	key: string;
};

type EmbeddedAdminRouterContextValue = {
	location: EmbeddedAdminLocation;
	navigate: (to: To, options?: NavigateOptions) => void;
};

const EmbeddedAdminRouterContext =
	React.createContext<EmbeddedAdminRouterContextValue | null>(null);

function createEmbeddedLocation(
	pathname: string,
	options?: {
		search?: string;
		hash?: string;
		state?: unknown;
	}
): EmbeddedAdminLocation {
	return {
		pathname,
		search: options?.search ?? '',
		hash: options?.hash ?? '',
		state: options?.state ?? null,
		key: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
	};
}

let persistedEmbeddedAdminLocation = createEmbeddedLocation(ADMIN_ROUTES.ROOT);

export const EmbeddedAdminRouterProvider: React.FC<React.PropsWithChildren> = ({
	children,
}) => {
	const [location, setLocation] = React.useState<EmbeddedAdminLocation>(
		persistedEmbeddedAdminLocation
	);

	const navigate = React.useCallback((to: To, options?: NavigateOptions) => {
		setLocation((current) => {
			const resolved = resolvePath(to, current.pathname);
			const nextLocation = createEmbeddedLocation(resolved.pathname, {
				search: resolved.search,
				hash: resolved.hash,
				state: options?.state,
			});
			persistedEmbeddedAdminLocation = nextLocation;
			return nextLocation;
		});
	}, []);

	const value = React.useMemo(
		() => ({
			location,
			navigate,
		}),
		[location, navigate]
	);

	return (
		<EmbeddedAdminRouterContext.Provider value={value}>
			{children}
		</EmbeddedAdminRouterContext.Provider>
	);
};

export function useEmbeddedAdminLocation() {
	const context = React.useContext(EmbeddedAdminRouterContext);

	if (!context) {
		throw new Error(
			'useEmbeddedAdminLocation must be used within EmbeddedAdminRouterProvider'
		);
	}

	return context.location;
}

export function useAdminNavigate() {
	const isDesktopEmbedded = useIsDesktopEmbeddedAdmin();
	const browserNavigate = useNavigate();
	const embeddedRouter = React.useContext(EmbeddedAdminRouterContext);

	return React.useCallback(
		(to: To, options?: NavigateOptions) => {
			if (isDesktopEmbedded && embeddedRouter) {
				embeddedRouter.navigate(to, options);
				return;
			}

			browserNavigate(to, options);
		},
		[browserNavigate, embeddedRouter, isDesktopEmbedded]
	);
}

export function useAdminSearchParams() {
	const isDesktopEmbedded = useIsDesktopEmbeddedAdmin();
	const [browserSearchParams, setBrowserSearchParams] = useSearchParams();
	const embeddedRouter = React.useContext(EmbeddedAdminRouterContext);

	const embeddedSearchParams = React.useMemo(() => {
		if (!embeddedRouter) {
			return new URLSearchParams();
		}

		return new URLSearchParams(embeddedRouter.location.search);
	}, [embeddedRouter]);

	const setEmbeddedSearchParams = React.useCallback(
		(
			nextInit: ConstructorParameters<typeof URLSearchParams>[0],
			options?: NavigateOptions
		) => {
			if (!embeddedRouter) {
				return;
			}

			const nextParams = new URLSearchParams(nextInit);
			const search = nextParams.toString();

			embeddedRouter.navigate(
				{
					pathname: embeddedRouter.location.pathname,
					search: search ? `?${search}` : '',
					hash: embeddedRouter.location.hash,
				},
				options
			);
		},
		[embeddedRouter]
	);

	if (isDesktopEmbedded && embeddedRouter) {
		return [embeddedSearchParams, setEmbeddedSearchParams] as const;
	}

	return [browserSearchParams, setBrowserSearchParams] as const;
}

export const AdminNavigate: React.FC<NavigateProps> = ({
	to,
	replace,
	state,
	relative,
}) => {
	const isDesktopEmbedded = useIsDesktopEmbeddedAdmin();
	const navigate = useAdminNavigate();

	React.useEffect(() => {
		if (!isDesktopEmbedded) {
			return;
		}

		navigate(to, { replace, state, relative });
	}, [isDesktopEmbedded, navigate, relative, replace, state, to]);

	if (isDesktopEmbedded) {
		return null;
	}

	return (
		<Navigate to={to} replace={replace} state={state} relative={relative} />
	);
};
