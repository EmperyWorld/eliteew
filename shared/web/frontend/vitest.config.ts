import { defineConfig as defineVitestConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
	viteConfig,
	defineVitestConfig({
		test: {
			environment: 'jsdom',
			globals: true,
			setupFiles: ['./src/test/setupTests.ts'],
			include: ['src/**/*.{test,spec}.{ts,tsx}'],
			exclude: ['node_modules', 'dist-build', 'dist'],
			pool: 'forks',
		},
	})
);
