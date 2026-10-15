/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string;
	readonly VITE_WS_URL?: string;
	readonly DEV: boolean;
	readonly PROD: boolean;
	readonly MODE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module '*.svg' {
	const content: React.FC<React.SVGProps<SVGElement>>;
	export default content;
}

declare module '*.png' {
	const value: string;
	export default value;
}

declare module '*.jpg' {
	const value: string;
	export default value;
}

declare module '*.jpeg' {
	const value: string;
	export default value;
}

declare module '*.gif' {
	const value: string;
	export default value;
}

declare module '*.webp' {
	const value: string;
	export default value;
}
