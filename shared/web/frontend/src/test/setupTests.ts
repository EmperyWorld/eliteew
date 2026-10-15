/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import { createMemoryStorage } from './memoryStorage';

/**
 * Node 26+: jsdom localStorage is unavailable unless `--localstorage-file` is set.
 * Product tests rely on Storage for Poemma, desktop prefs, marketing selection, etc.
 */
if (typeof globalThis.localStorage === 'undefined') {
	globalThis.localStorage = createMemoryStorage();
}
if (typeof globalThis.sessionStorage === 'undefined') {
	globalThis.sessionStorage = createMemoryStorage();
}

/**
 * Bootstrap global i18n once for tests that render without a dedicated I18nextProvider.
 * Per-file `react-i18next` mocks must spread `importOriginal` and keep `initReactI18next`.
 */
await import('@/i18n/config');
