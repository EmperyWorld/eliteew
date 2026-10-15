/// <reference types="vite/client" />

declare module '*.txt?raw' {
	const content: string;
	export default content;
}

declare module '*.json?raw' {
	const content: string;
	export default content;
}

interface ImportMetaEnv {
  readonly VITE_DESKTOP_CLIENT_ENROLL_BASE?: string;
  readonly VITE_DESKTOP_CLIENT_APP_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
