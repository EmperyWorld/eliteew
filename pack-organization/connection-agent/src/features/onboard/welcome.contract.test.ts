/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * W3 source locks — Welcome (2) + Activation + onboarding persistence wiring.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3 / wave W3
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AFTER_LOCAL_RESET_KEY,
	consumeAfterLocalReset,
	markAfterLocalResetForRestart,
	markOnboardingCompleted,
	ONBOARDING_COMPLETED_KEY,
	readOnboardingCompleted,
} from "../../lib/launcher/journey/onboardingPersistence";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const app = join(root, "App.tsx");
const welcome = join(root, "features/onboard/WelcomeTour.tsx");
const activation = join(root, "features/activation/ActivationScreen.tsx");

describe("Journey W3 Welcome + Activation (source)", () => {
	it("App wires Welcome/Activation via phaseAfterIdentifying onboarding flags", () => {
		const src = readFileSync(app, "utf8");
		expect(src).toContain("WelcomeTour");
		expect(src).toContain("ActivationScreen");
		expect(src).toContain("readOnboardingCompleted");
		expect(src).toContain("consumeAfterLocalReset");
		expect(src).toContain("markOnboardingCompleted");
		expect(src).toContain("showWelcome");
		expect(src).toContain("showActivation");
		expect(src).toContain("onboardingCompleted");
		expect(src).toContain("afterLocalReset");
		expect(src).not.toMatch(/showHomeDropZone/);
		expect(src).not.toMatch(/from ['"].*HomeScreen['"]/);
	});

	it("WelcomeTour is exactly two slides with site + license contact", () => {
		const src = readFileSync(welcome, "utf8");
		expect(src).toContain("useState<1 | 2>");
		expect(src).toContain("Перейти к активации");
		expect(src).toContain("ELITEEW_SITE_URL");
		expect(src).toContain("LICENSE_CONTACT_EMAIL");
		expect(src).not.toContain("slide === 3");
	});

	it("ActivationScreen owns single hero; HomeScreen is drop body only", () => {
		const src = readFileSync(activation, "utf8");
		const home = readFileSync(
			join(root, "features/home/HomeScreen.tsx"),
			"utf8",
		);
		expect(src).toContain("HomeScreen");
		expect(src).toContain("AirEnrollPanel");
		expect(src).toContain("Активация");
		expect(src).toContain("Доступ к EliteEW");
		expect(src).toContain("activation-hero");
		expect(home).not.toContain("Добро пожаловать");
		expect(home).not.toContain("Активация");
		expect(home).not.toContain("home-aside");
		expect(home).not.toContain("mode-legend");
		expect(home).toContain("home-panel-activation");
		expect(home).toContain("Подготовить запрос устройства");
	});
});

describe("onboardingPersistence", () => {
	const store = new Map<string, string>();

	beforeEach(() => {
		store.clear();
		vi.stubGlobal("localStorage", {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, String(v));
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
			clear: () => store.clear(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("marks and reads onboarding_completed", () => {
		expect(readOnboardingCompleted()).toBe(false);
		markOnboardingCompleted();
		expect(store.get(ONBOARDING_COMPLETED_KEY)).toBe("1");
		expect(readOnboardingCompleted()).toBe(true);
	});

	it("consumes after_local_reset once", () => {
		markAfterLocalResetForRestart();
		expect(store.get(AFTER_LOCAL_RESET_KEY)).toBe("1");
		expect(consumeAfterLocalReset()).toBe(true);
		expect(store.get(AFTER_LOCAL_RESET_KEY)).toBeUndefined();
		expect(consumeAfterLocalReset()).toBe(false);
	});
});
