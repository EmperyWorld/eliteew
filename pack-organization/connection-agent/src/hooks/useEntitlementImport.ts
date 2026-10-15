/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Raw JSON entitlement import (legacy secondary). Path import removed in Wave 1.
 */

import { useCallback, useState } from 'react';
import { bindPatchFromEntitlement } from '../lib/launcher/bindHydration';
import type { LauncherStep } from '../lib/launcher/stepGates';
import {
	entitlementImportJson,
	type EntitlementStatusView,
} from '../lib/tauri-bridge/commands';
import { humanizeEntitlement } from '../lib/ui/statusCopy';

export function useEntitlementImport(opts: {
	setEntitlement: (ent: EntitlementStatusView) => void;
	setStep: (step: LauncherStep) => void;
	setLauncherDetail: (detail: string) => void;
	setBindLicenseId: (id: string | null) => void;
	setBindDeviceId: (id: string | null) => void;
	refreshDenylist: () => Promise<unknown>;
}) {
	const {
		setEntitlement,
		setStep,
		setLauncherDetail,
		setBindLicenseId,
		setBindDeviceId,
		refreshDenylist,
	} = opts;

	const [importPath, setImportPath] = useState('');
	const [importBusy, setImportBusy] = useState(false);

	const applyEntitlementOk = useCallback(
		async (ent: EntitlementStatusView) => {
			setEntitlement(ent);
			const patch = bindPatchFromEntitlement(ent);
			if (patch.licenseId) setBindLicenseId(patch.licenseId);
			if (patch.deviceId) setBindDeviceId(patch.deviceId);
			if (ent.ok) {
				setStep('shell');
				setLauncherDetail(humanizeEntitlement(ent.code, ent.message));
				await refreshDenylist();
			}
		},
		[
			refreshDenylist,
			setBindDeviceId,
			setBindLicenseId,
			setEntitlement,
			setLauncherDetail,
			setStep,
		]
	);

	const handleImport = useCallback(async () => {
		setImportBusy(true);
		try {
			void importPath;
			// Wave 1: arbitrary-path entitlement import removed (F-11).
			setEntitlement({
				ok: false,
				code: 'entitlement_import_path_removed',
				message:
					'Импорт по пути файла больше не поддерживается. Вставьте JSON пакета или используйте файл доступа.',
			});
		} finally {
			setImportBusy(false);
		}
	}, [importPath, setEntitlement]);

	const handleImportJsonText = useCallback(
		async (raw: string) => {
			setImportBusy(true);
			try {
				const ent = await entitlementImportJson(raw);
				await applyEntitlementOk(ent);
			} catch (err) {
				setEntitlement({
					ok: false,
					code: 'import_error',
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				setImportBusy(false);
			}
		},
		[applyEntitlementOk, setEntitlement]
	);

	return {
		importPath,
		setImportPath,
		importBusy,
		setImportBusy,
		handleImport,
		handleImportJsonText,
	};
}
