/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Every Hub `invoke()` must have a matching main/product capability allow.
 * Missing ACL silently disables Start (license preflight never reaches the API).
 *
 * Related:
 * - src-tauri/capabilities/default.json
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §6
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "../../..");

function permissionIds(raw: string): string[] {
	const doc = JSON.parse(raw) as {
		permissions: Array<string | { identifier?: string }>;
	};
	return doc.permissions.map((p) =>
		typeof p === "string" ? p : String(p.identifier ?? ""),
	);
}

function allowId(command: string): string {
	return `allow-${command.replaceAll("_", "-")}`;
}

describe("Hub invoke ↔ capability ACL", () => {
	const commandsTs = readFileSync(join(here, "commands.ts"), "utf8");
	const mainPerms = permissionIds(
		readFileSync(
			join(desktopRoot, "src-tauri/capabilities/default.json"),
			"utf8",
		),
	);
	const productPerms = permissionIds(
		readFileSync(
			join(desktopRoot, "src-tauri/capabilities/product.json"),
			"utf8",
		),
	);
	const allowed = new Set([...mainPerms, ...productPerms]);
	const invokeNames = [
		...commandsTs.matchAll(/invoke(?:<[^>]+>)?\(\s*'([a-z0-9_]+)'/g),
	].map((m) => m[1]);

	it("every TS invoke has a retail capability allow", () => {
		const missing = [...new Set(invokeNames)]
			.map((name) => ({ name, allow: allowId(name) }))
			.filter((row) => !allowed.has(row.allow));
		expect(missing).toEqual([]);
	});

	it("license preflight/heartbeat are main-only (not product WebView)", () => {
		expect(mainPerms).toEqual(
			expect.arrayContaining([
				"allow-license-preflight-cmd",
				"allow-license-heartbeat-cmd",
			]),
		);
		expect(productPerms.join("\n")).not.toMatch(
			/license-preflight|license-heartbeat/,
		);
	});

	it("host network mutate/status are main-only; link snapshot is on product", () => {
		expect(mainPerms).toEqual(
			expect.arrayContaining([
				"allow-host-network-status",
				"allow-host-network-link-snapshot",
				"allow-host-network-wired-apply",
				"allow-host-network-wifi-scan",
				"allow-host-network-wifi-connect",
				"allow-host-network-wifi-disconnect",
			]),
		);
		expect(productPerms).toEqual(
			expect.arrayContaining(["allow-host-network-link-snapshot"]),
		);
		expect(productPerms.join("\n")).not.toMatch(
			/host-network-status|host-network-wired-apply|host-network-wifi/,
		);
	});

	it("air enroll exchange is main-only (not product WebView)", () => {
		expect(mainPerms).toEqual(
			expect.arrayContaining(["allow-air-enroll-exchange"]),
		);
		expect(productPerms.join("\n")).not.toMatch(/air-enroll/);
	});

	it("native OIDC commands are main-only (not product WebView)", () => {
		expect(mainPerms).toEqual(
			expect.arrayContaining([
				"allow-native-oidc-start",
				"allow-native-oidc-complete",
				"allow-native-oidc-refresh",
				"allow-native-oidc-logout",
				"allow-native-oidc-interactive-login",
			]),
		);
		expect(productPerms.join("\n")).not.toMatch(/native-oidc/);
	});

	it("product session refresh/logout are product-only and not native_oidc_*", () => {
		expect(productPerms).toEqual(
			expect.arrayContaining([
				"allow-product-session-refresh",
				"allow-product-session-logout",
				"allow-video-call-meet-stage-open",
				"allow-video-call-meet-stage-set-bounds",
				"allow-video-call-meet-stage-close",
			]),
		);
		expect(mainPerms.join("\n")).not.toMatch(/product-session-/);
		expect(mainPerms.join("\n")).not.toMatch(/video-call-meet-stage/);
		expect(productPerms.join("\n")).not.toMatch(/native-oidc/);
	});

	it("Connected product origin may use session + Meet-stage remote capability (not product.json)", () => {
		const productCap = readFileSync(
			join(desktopRoot, "src-tauri/capabilities/product.json"),
			"utf8",
		);
		const connectedCap = readFileSync(
			join(
				desktopRoot,
				"src-tauri/capabilities/product-connected-session.json",
			),
			"utf8",
		);
		expect(productCap).not.toMatch(/"remote"/);
		expect(connectedCap).toContain('"https://app.eliteew.ru"');
		expect(connectedCap).toContain('"https://app.eliteew.ru/*"');
		expect(connectedCap).toContain("allow-product-session-refresh");
		expect(connectedCap).toContain("allow-product-session-logout");
		expect(connectedCap).toMatch(/"local"\s*:\s*true/);
		expect(connectedCap).not.toMatch(/https:\/\/\*\.eliteew\.ru/);
		expect(connectedCap).not.toMatch(/https:\/\/auth\.eliteew\.ru/);
		expect(JSON.parse(connectedCap).permissions).toEqual([
			"core:default",
			"allow-product-session-refresh",
			"allow-product-session-logout",
			"allow-host-network-link-snapshot",
			"allow-video-call-meet-stage-open",
			"allow-video-call-meet-stage-set-bounds",
			"allow-video-call-meet-stage-close",
		]);
	});
});
