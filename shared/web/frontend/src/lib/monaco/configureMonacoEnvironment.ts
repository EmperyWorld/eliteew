/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Register Monaco web workers via Vite ``?worker`` bundles so the editor does not fall back
 * to the main thread (``MonacoEnvironment.getWorker`` required for ESM + CSP ``script-src 'self'``).
 *
 * Invariants:
 * - Must load before ``import 'monaco-editor'`` (side-effect only; imported from configureMonacoLoader).
 * - Preserves any existing ``globalThis.MonacoEnvironment`` fields (e.g. trusted types).
 * - monaco-editor ≥0.56 ``exports`` maps ``./*`` → ``./esm/vs/*.js`` — use short worker ids
 *   (``monaco-editor/editor/editor.worker``), not ``monaco-editor/esm/vs/...`` (double-prefix miss).
 *
 * Related:
 * - src/lib/monaco/configureMonacoLoader.ts
 * - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
 */
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

type MonacoWorkerFactory = new () => Worker;

function workerForLabel(label: string): Worker {
	switch (label) {
		case 'json':
			return new (jsonWorker as MonacoWorkerFactory)();
		case 'css':
		case 'scss':
		case 'less':
			return new (cssWorker as MonacoWorkerFactory)();
		case 'html':
		case 'handlebars':
		case 'razor':
			return new (htmlWorker as MonacoWorkerFactory)();
		case 'typescript':
		case 'javascript':
			return new (tsWorker as MonacoWorkerFactory)();
		default:
			return new (editorWorker as MonacoWorkerFactory)();
	}
}

const previous = globalThis.MonacoEnvironment;

globalThis.MonacoEnvironment = {
	...previous,
	getWorker(_workerId: string, label: string): Worker {
		return workerForLabel(label);
	},
};
