/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy license_key redeem helper — fail-closed after Wave 1 IPC hardening.
 *
 * Invariants:
 * - Retail activation is capsule_import_channel / seat channel, not license_redeem IPC.
 * - Callers must treat this as unsupported and show recovery copy.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
 */

export type RedeemLicenseArgs = {
	enrollBase: string;
	licenseKey: string;
	devicePubkey: string;
	machineFingerprint: string;
};

export type RedeemLicenseResult =
	| {
			ok: true;
			license_id: string;
			device_id: string;
			edition?: string | null;
			entitlement?: unknown;
			allow_offline?: boolean;
			allow_online?: boolean;
			allow_fofline?: boolean;
	  }
	| { ok: false; code: string; message: string };

export async function redeemLicense(
	_args: RedeemLicenseArgs
): Promise<RedeemLicenseResult> {
	return {
		ok: false,
		code: 'license_redeem_removed',
		message:
			'Активация ключом в этом клиенте недоступна. Импортируйте файл доступа от администратора.',
	};
}
