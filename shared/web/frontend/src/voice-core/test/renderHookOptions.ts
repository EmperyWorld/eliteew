/**
 * RTL wraps hooks in StrictMode by default; async hooks that await getUserMedia
 * can finish after a strict remount, so setState is dropped while global side
 * effects (e.g. registerMicActive) still run. Disable for voice-core hook tests.
 */
export const renderHookNoStrict = { reactStrictMode: false } as const;
