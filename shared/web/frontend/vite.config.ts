import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';
import { compression } from 'vite-plugin-compression2';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { buildVersionFilePlugin } from './vite-plugin-build-version.ts';

const packagePathMatchers = {
	react: [
		/[\\/]node_modules[\\/]react[\\/]/,
		/[\\/]node_modules[\\/]react$/,
		/[\\/]node_modules[\\/]\.pnpm[\\/]react@[^\\/]+[\\/]node_modules[\\/]react([\\/]|$)/,
	],
	reactDom: [
		/[\\/]node_modules[\\/]react-dom[\\/]/,
		/[\\/]node_modules[\\/]react-dom$/,
		/[\\/]node_modules[\\/]\.pnpm[\\/]react-dom@[^\\/]+[\\/]node_modules[\\/]react-dom([\\/]|$)/,
	],
	scheduler: [
		/[\\/]node_modules[\\/]scheduler[\\/]/,
		/[\\/]node_modules[\\/]scheduler$/,
		/[\\/]node_modules[\\/]\.pnpm[\\/]scheduler@[^\\/]+[\\/]node_modules[\\/]scheduler([\\/]|$)/,
	],
	useSyncExternalStore: [
		/[\\/]node_modules[\\/]use-sync-external-store[\\/]/,
		/[\\/]node_modules[\\/]use-sync-external-store$/,
		/[\\/]node_modules[\\/]\.pnpm[\\/]use-sync-external-store@[^\\/]+[\\/]node_modules[\\/]use-sync-external-store([\\/]|$)/,
	],
};

function matchesPackagePath(id: string, patterns: RegExp[]): boolean {
	return patterns.some((pattern) => pattern.test(id));
}

/** Basename patterns for chunks that must not get `<link rel="modulepreload">` on cold start. */
const MODULE_PRELOAD_DEFER_PATTERN =
	/(?:^|\/)(?:excalidraw(?:-|$)|recharts-vendor|UGSDesktopContainer|monaco-vendor|exceljs-vendor|markdown-vendor|katex-vendor|doc-io-vendor|presentation-vendor|canvas-vendor|flow-vendor|pdf\.worker|UnifiedAdminPage|MarketingCabinetPage|SiteStudioAdminShell|UltimateDocEditor|TiptapEditor|MusicGeneratorPage|DesktopWorkspaceContent|UserSiteStudio|exceljs\.min|framer-motion)/;

function filterModulePreloadDependencies(deps: string[]): string[] {
	return deps.filter((dep) => !MODULE_PRELOAD_DEFER_PATTERN.test(dep));
}

const devHost = process.env.VITE_DEV_SERVER_HOST || '127.0.0.1';
const allowedHosts = (
	process.env.VITE_DEV_ALLOWED_HOSTS ??
	'app.eliteew.ru,eliteew.ru,localhost,127.0.0.1,.eliteew.ru'
)
	.split(',')
	.map((host) => host.trim())
	.filter(Boolean);
const useHttps = process.env.VITE_DEV_SERVER_HTTPS === 'false';
const hmrHost =
	process.env.VITE_DEV_SERVER_HMR_HOST ||
	process.env.VITE_DEV_SERVER_HOST ||
	'app.eliteew.ru';
const hmrClientPort = Number(
	process.env.VITE_DEV_SERVER_CLIENT_PORT || (useHttps ? 443 : 3000)
);
const serverPort = Number(process.env.VITE_DEV_SERVER_PORT || 3000);
const buildOutDir = process.env.VITE_OUT_DIR || 'dist-build';
const isAnalyze = process.env.ANALYZE === 'true';
/** Default off: `vite-plugin-image-optimizer` + `sharp` pull non-MIT native deps (libvips). Enable explicitly for release image passes. */
const enableImageOptimization = process.env.VITE_IMAGE_OPTIMIZER === 'true';
const enablePrecompression = process.env.VITE_PRECOMPRESS === 'true';
/** React Compiler (Babel): только при VITE_REACT_COMPILER=true|1 (по умолчанию выкл.) */
const enableReactCompiler =
	process.env.VITE_REACT_COMPILER === 'true' ||
	process.env.VITE_REACT_COMPILER === '1';
const frontendNodeModules = path.resolve(import.meta.dirname, './node_modules');

const vitePlugins: PluginOption[] = [
	react(),
	...(enableReactCompiler
		? [
				babel({
					presets: [reactCompilerPreset()],
				}) as PluginOption,
			]
		: []),
	buildVersionFilePlugin(),
];

if (enablePrecompression) {
	vitePlugins.push(
		compression({
			algorithms: ['gzip', 'brotliCompress'],
		})
	);
}

if (enableImageOptimization) {
	vitePlugins.push(ViteImageOptimizer());
}

if (isAnalyze) {
	vitePlugins.push(
		visualizer({
			filename: path.resolve(
				import.meta.dirname,
				buildOutDir,
				'bundle-stats.html'
			),
			template: 'treemap',
			gzipSize: true,
			brotliSize: true,
			open: false,
		}) as PluginOption
	);
	// bundle-stats.html — только локальный анализ; не копировать в прод-том dist-build при деплое.
}

export default defineConfig({
	plugins: vitePlugins,
	base: '/',

	server: {
		port: serverPort,
		host: devHost,
		...(useHttps ? { https: {} } : {}),

		cors: true,
		allowedHosts,
		strictPort: true,

		hmr: {
			host: hmrHost,
			clientPort: hmrClientPort,
			protocol: useHttps ? 'wss' : 'ws',
		},

		// Proxy configuration
		proxy: {
			'/api': {
				target: 'http://stack0-eliteew-api-prod:8000',
				changeOrigin: true,
				secure: false,
				ws: true,
				rewrite: (path: string) => path.replace(/^\/api/, ''),
			},
			// Legacy catch-all `/ws` retired 2026-07-28; keep probe + Socket.IO only.
			'/ws/health': {
				target: 'http://stack0-eliteew-api-prod:8000',
				changeOrigin: true,
				secure: false,
			},
			'/socket.io': {
				target: 'ws://stack0-eliteew-api-prod:8000',
				changeOrigin: true,
				secure: false,
				ws: true,
			},
		},
	},

	// ... остальная конфигурация без изменений
	resolve: {
		dedupe: [
			'react',
			'react-dom',
			'react-router',
			'scheduler',
			'use-sync-external-store',
			'@tanstack/react-query',
			'zustand',
		],
		alias: [
			{
				find: /^react$/,
				replacement: path.resolve(frontendNodeModules, 'react/index.js'),
			},
			{
				find: /^react\/jsx-runtime$/,
				replacement: path.resolve(frontendNodeModules, 'react/jsx-runtime.js'),
			},
			{
				find: /^react\/jsx-dev-runtime$/,
				replacement: path.resolve(
					frontendNodeModules,
					'react/jsx-dev-runtime.js'
				),
			},
			{
				find: /^react-dom$/,
				replacement: path.resolve(frontendNodeModules, 'react-dom/index.js'),
			},
			{
				find: /^react-dom\/client$/,
				replacement: path.resolve(frontendNodeModules, 'react-dom/client.js'),
			},
			{
				find: /^@tiptap\/react\/menus$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./node_modules/@tiptap/react/src/menus/index.ts'
				),
			},
			{
				find: /^@tiptap\/core\/jsx-runtime$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./node_modules/@tiptap/core/src/jsx-runtime.ts'
				),
			},
			{
				find: /^@tiptap\/core\/jsx-dev-runtime$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./node_modules/@tiptap/core/src/jsx-runtime.ts'
				),
			},
			{
				find: /^@tiptap\/y-tiptap$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./node_modules/@tiptap/y-tiptap/dist/y-tiptap.js'
				),
			},
			{
				find: /^@tiptap\/extensions\/(.+)$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./node_modules/@tiptap/extensions/src/$1/index.ts'
				),
			},
			{
				find: /^@tiptap\/pm\/(.+)$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./node_modules/@tiptap/pm/$1'
				),
			},
			{
				find: /^@tiptap\/([^/]+)$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./node_modules/@tiptap/$1/src/index.ts'
				),
			},
			{
				find: '@components',
				replacement: path.resolve(import.meta.dirname, './src/components'),
			},
			{
				find: '@services',
				replacement: path.resolve(import.meta.dirname, './src/services'),
			},
			{
				find: '@hooks',
				replacement: path.resolve(import.meta.dirname, './src/hooks'),
			},
			{
				find: '@store',
				replacement: path.resolve(import.meta.dirname, './src/store'),
			},
			{
				find: '@stores',
				replacement: path.resolve(import.meta.dirname, './src/stores'),
			},
			{
				find: '@utils',
				replacement: path.resolve(import.meta.dirname, './src/utils'),
			},
			{
				find: '@constants',
				replacement: path.resolve(import.meta.dirname, './src/constants'),
			},
			{
				find: '@typings',
				replacement: path.resolve(import.meta.dirname, './src/types'),
			},
			{
				find: '@types',
				replacement: path.resolve(import.meta.dirname, './src/types'),
			},
			{ find: '@', replacement: path.resolve(import.meta.dirname, './src') },
		],
		extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
	},

	optimizeDeps: {
		include: [
			'react',
			'react-dom',
			'scheduler',
			'use-sync-external-store',
			...(enableReactCompiler ? (['react/compiler-runtime'] as const) : []),
			'axios',
			'framer-motion',
			'socket.io-client',
			'recharts',
			'idb',
			'comlink',
			'@tiptap/react',
			'@tiptap/starter-kit',
			'@monaco-editor/react',
			'prosemirror-state',
			'prosemirror-view',
			'prosemirror-model',
			'lowlight',
		],
		exclude: [],
	},

	build: {
		modulePreload: {
			resolveDependencies: (_filename, deps) =>
				filterModulePreloadDependencies(deps),
		},
		sourcemap: false,
		// Default dist-build to avoid EACCES when dist/ is mounted/owned by root. Deploy: use dist-build or run VITE_OUT_DIR=dist pnpm build when dist is writable.
		outDir: buildOutDir,
		// Clean output dir before each build so old hashed chunks don't accumulate (was false for rolling updates; deploy typically replaces the whole dir anyway).
		emptyOutDir: true,
		manifest: true,
		// ✅ FIX: Increase chunk size warning limit for large libraries
		chunkSizeWarningLimit: 1500,
		rollupOptions: {
			input: {
				main: path.resolve(import.meta.dirname, 'index.html'),
				mobileApp: path.resolve(import.meta.dirname, 'mobile-app/index.html'),
			},
			// ✅ FIX: Ensure proper dependency resolution to avoid circular dependencies
			output: {
				chunkFileNames: 'assets/[name]-[hash].js',
				manualChunks: (id: string) => {
					// Vite/Rolldown virtual modules (modulepreload polyfill, __vitePreload helper)
					// must never land in the same manual chunk as heavy libs. Rolldown often
					// ignores virtual-id routing and co-locates `__vitePreload` into the first
					// heavy *named* chunk that owns `import()` — then main/mainFullApp statically
					// import that multi-MB chunk on every cold boot. Do not create named chunks
					// for Monaco/Excalidraw/Recharts/ExcelJS/KaTeX/PDF/Codemirror/Konva/xyflow/…
					if (
						id.includes('\0vite') ||
						id.includes('\0rolldown') ||
						id.includes('preload-helper') ||
						id.includes('vite/modulepreload-polyfill') ||
						id.includes('vite/preload-helper') ||
						/[\\/]vite[\\/]dist[\\/]client[\\/]/.test(id)
					) {
						return 'vite-client-runtime';
					}
					// Shared tiny deps used by cold shell (`cn`, preloader).
					if (
						id.includes('node_modules/clsx') ||
						id.includes('node_modules/tailwind-merge')
					) {
						return 'vendor-utils';
					}
					// React vendor in one chunk (unstable_now fix)
					if (
						matchesPackagePath(id, packagePathMatchers.react) ||
						matchesPackagePath(id, packagePathMatchers.reactDom) ||
						matchesPackagePath(id, packagePathMatchers.scheduler) ||
						matchesPackagePath(id, packagePathMatchers.useSyncExternalStore)
					) {
						return 'react-vendor';
					}
					if (id.includes('node_modules/@chakra-ui')) {
						return 'chakra-ui';
					}
					if (id.includes('node_modules/framer-motion')) {
						return 'framer-motion';
					}
					if (id.includes('node_modules/@heroicons/react')) {
						return 'icons';
					}
					// Heavy editors/charts/doc libs: NO named manualChunks (pdf/excalidraw/monaco/
					// recharts lessons). Leave them only in lazy route chunks so `__vitePreload`
					// and shared `clsx` stay on the cold path.
					// Worker libraries
					if (
						id.includes('node_modules/comlink') ||
						id.includes('node_modules/idb')
					) {
						return 'worker-vendor';
					}
					// TanStack Query - state management
					if (id.includes('node_modules/@tanstack/react-query')) {
						return 'tanstack-query';
					}
					// Zustand - state management
					if (id.includes('node_modules/zustand')) {
						return 'zustand';
					}
					// Socket.IO - real-time communication
					if (id.includes('node_modules/socket.io-client')) {
						return 'socketio';
					}
					// Large utility libraries
					if (
						id.includes('node_modules/axios') ||
						id.includes('node_modules/date-fns')
					) {
						return 'vendor-utils';
					}
					if (id.includes('UnifiedTopNavBar') && !id.includes('node_modules')) {
						return 'UnifiedTopNavBar';
					}
				},
				// ✅ CRITICAL FIX: Ensure proper module loading order
				// react-core must load before use-sync-external-store
				entryFileNames: 'assets/[name]-[hash].js',
				// Ensure worker files are handled correctly
				assetFileNames: (assetInfo: { name?: string }) => {
					if (assetInfo.name?.endsWith('.mjs')) {
						return 'assets/[name]-[hash][extname]';
					}
					return 'assets/[name]-[hash][extname]';
				},
			},
		},
		// Vite 8 / Rolldown: oxc is the supported production minifier. TDZ is
		// fixed in source cycles, not by shipping unminified JS.
		minify: 'oxc',
	},

	preview: {
		host: true,
		port: 4173,
	},

	define: {
		'process.env': {},
		global: 'globalThis',
		__VERSION__: JSON.stringify('0.16.34'),
	},

	worker: {
		format: 'es',
	},

	assetsInclude: ['**/*.wasm'],
});
