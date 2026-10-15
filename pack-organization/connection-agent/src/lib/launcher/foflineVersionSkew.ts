/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest FoFline version skew between shell semver, local SPA pack, and
 * remote spa-latest (L4) — no silent mix of incompatible packs.
 *
 * Invariants:
 * - Ready local pack stays Start-eligible while an update is offered.
 * - Shell OTA and SPA pack are separate channels; never merge into one version.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11.5 / L4
 */

export type FoflineVersionSkewKind =
	| 'spa_missing'
	| 'spa_update_available'
	| 'spa_current'
	| 'check_unavailable'
	| 'shell_update_also';

export type FoflineVersionSkew = {
	kind: FoflineVersionSkewKind;
	/** Machine code for statusCopy / UI strip. */
	code: string;
	localSpaAppBuildId: string | null;
	remoteSpaAppBuildId: string | null;
	shellVersion: string;
	shellUpdateAvailable: string | null;
	/** True when Start may keep using the installed local pack. */
	localPackUsable: boolean;
	/** True when user should run SPA pack sync (not shell updater). */
	spaUpdateAction: boolean;
};

export type FoflineVersionSkewInput = {
	shellVersion: string;
	packState: string;
	localSpaAppBuildId: string | null;
	remoteSpaAppBuildId: string | null;
	/** When true, remote was checked and differs from local. */
	spaUpdateAvailable?: boolean;
	/** When true, remote check failed (offline) but local may still be ready. */
	remoteCheckFailed?: boolean;
	shellUpdateAvailable?: string | null;
};

/**
 * Resolve shell ↔ SPA ↔ server honesty without inventing a unified version.
 */
export function resolveFoflineVersionSkew(
	input: FoflineVersionSkewInput
): FoflineVersionSkew {
	const shellVersion = (input.shellVersion ?? '').trim() || '?';
	const local = (input.localSpaAppBuildId ?? '').trim() || null;
	const remote = (input.remoteSpaAppBuildId ?? '').trim() || null;
	const shellUpdate = (input.shellUpdateAvailable ?? '').trim() || null;
	const state = (input.packState ?? '').trim();
	const ready = state === 'ready' && Boolean(local);

	if (!ready) {
		return {
			kind: 'spa_missing',
			code: state === 'denied' ? 'allow_fofline_required' : 'pack_missing',
			localSpaAppBuildId: local,
			remoteSpaAppBuildId: remote,
			shellVersion,
			shellUpdateAvailable: shellUpdate,
			localPackUsable: false,
			spaUpdateAction: state === 'pack_missing' || state === 'error',
		};
	}

	const updateFlag =
		input.spaUpdateAvailable === true ||
		(Boolean(remote) && Boolean(local) && remote !== local);

	if (updateFlag && remote && local && remote !== local) {
		return {
			kind: 'spa_update_available',
			code: 'update_available',
			localSpaAppBuildId: local,
			remoteSpaAppBuildId: remote,
			shellVersion,
			shellUpdateAvailable: shellUpdate,
			localPackUsable: true,
			spaUpdateAction: true,
		};
	}

	if (input.remoteCheckFailed === true) {
		return {
			kind: 'check_unavailable',
			code: 'update_check_offline',
			localSpaAppBuildId: local,
			remoteSpaAppBuildId: remote,
			shellVersion,
			shellUpdateAvailable: shellUpdate,
			localPackUsable: true,
			spaUpdateAction: false,
		};
	}

	if (shellUpdate) {
		return {
			kind: 'shell_update_also',
			code: 'ready',
			localSpaAppBuildId: local,
			remoteSpaAppBuildId: remote ?? local,
			shellVersion,
			shellUpdateAvailable: shellUpdate,
			localPackUsable: true,
			spaUpdateAction: false,
		};
	}

	return {
		kind: 'spa_current',
		code: 'ready',
		localSpaAppBuildId: local,
		remoteSpaAppBuildId: remote ?? local,
		shellVersion,
		shellUpdateAvailable: null,
		localPackUsable: true,
		spaUpdateAction: false,
	};
}
