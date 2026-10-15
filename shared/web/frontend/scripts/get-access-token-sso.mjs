#!/usr/bin/env node
/**
 * Получить access_token через реальный browser SSO (Keycloak), без password grant.
 *
 * Для клиента с выключенным direct access grants единственный стабильный путь — тот же flow,
 * что и у SPA (empery-web): открыть приложение, при редиректе залогиниться, перехватить
 * первый запрос фронта к /api с Authorization: Bearer.
 *
 * Требования: `pnpm exec playwright install chromium` (один раз на машине).
 *
 * Env:
 *   ELITEEW_TEST_USER_EMAIL     (default: testuser@eliteew.ru)
 *   ELITEEW_TEST_USER_PASSWORD
 *   ELITEEW_APP_URL             (default: https://app.eliteew.ru/#desktop)
 *   HEADED=1                    — не headless (отладка)
 *   ELITEEW_IGNORE_TLS_ERRORS=1 — ignoreHTTPSErrors в контексте
 *
 * Вывод: одна строка JSON { "access_token": "..." } в stdout.
 */

import { chromium } from 'playwright';
import process from 'node:process';

const APP_URL =
	process.env.ELITEEW_APP_URL ?? 'https://app.eliteew.ru/#desktop';
const EMAIL =
	process.env.ELITEEW_TEST_USER_EMAIL ?? 'testuser@eliteew.ru';
const PASSWORD = process.env.ELITEEW_TEST_USER_PASSWORD ?? '';

async function keycloakLogin(page, email, password) {
	if (!password) {
		throw new Error(
			'Set ELITEEW_TEST_USER_PASSWORD (password grant is disabled for empery-api; SSO needs real login).'
		);
	}

	const username = page.locator('input#username, input[name="username"]').first();
	await username.waitFor({ state: 'visible', timeout: 90_000 });
	await username.fill(email);

	const passwordInput = page
		.locator('input#password, input[name="password"]')
		.first();
	const submit = page
		.locator(
			'#kc-login, button#kc-login, input#kc-login, button[type="submit"], input[type="submit"]'
		)
		.first();

	if (await passwordInput.isVisible().catch(() => false)) {
		await passwordInput.fill(password);
		await submit.click();
		return;
	}

	await submit.click();
	await passwordInput.waitFor({ state: 'visible', timeout: 30_000 });
	await passwordInput.fill(password);
	await submit.click();
}

function waitForBearerOnApi(page, timeoutMs) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			page.off('request', onRequest);
			reject(
				new Error(
					`Timeout ${timeoutMs}ms: no request to URL containing /api with Authorization: Bearer`
				)
			);
		}, timeoutMs);

		function onRequest(request) {
			const url = request.url();
			if (!url.includes('/api')) return;
			const h = request.headers();
			const auth = h.authorization ?? h.Authorization;
			if (!auth || typeof auth !== 'string') return;
			const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
			if (!m?.[1]) return;
			clearTimeout(timer);
			page.off('request', onRequest);
			resolve(m[1].trim());
		}

		page.on('request', onRequest);
	});
}

async function main() {
	const headed = process.env.HEADED === '1' || process.env.HEADED === 'true';

	const browser = await chromium.launch({
		headless: !headed,
	});
	const context = await browser.newContext({
		ignoreHTTPSErrors: process.env.ELITEEW_IGNORE_TLS_ERRORS === '1',
	});
	const page = await context.newPage();

	const tokenPromise = waitForBearerOnApi(page, 180_000);

	await page.goto(APP_URL, {
		waitUntil: 'domcontentloaded',
		timeout: 120_000,
	});
	await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});

	const usernameField = page
		.locator('input#username, input[name="username"]')
		.first();
	let onKeycloak = await usernameField.isVisible().catch(() => false);
	if (!onKeycloak) {
		await new Promise((r) => setTimeout(r, 3000));
		onKeycloak = await usernameField.isVisible().catch(() => false);
	}

	if (onKeycloak) {
		await keycloakLogin(page, EMAIL, PASSWORD);
		await page.waitForURL(
			(u) => u.hostname.includes('app.eliteew.ru'),
			{ timeout: 120_000 }
		);
	}

	const access_token = await tokenPromise;
	await browser.close();

	process.stdout.write(
		`${JSON.stringify({ access_token })}\n`,
		'utf8'
	);
}

main().catch((err) => {
	console.error(err?.message ?? err);
	process.exit(1);
});
