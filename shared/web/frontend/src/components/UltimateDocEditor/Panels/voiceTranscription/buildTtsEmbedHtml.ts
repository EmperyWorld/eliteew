/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure HTML builder for TTS audio embed inserted into Ultimate Doc Editor document.
 *
 * Invariants:
 * - Output must include data-ude-embed="tts" and desktop CSS vars for theming.
 *
 * Related:
 * - useVoiceTranscriptionPanel.ts
 */

export interface BuildTtsEmbedHtmlParams {
	embedTitle: string;
	audioUnsupported: string;
	voice: string;
	langLabel: string;
	text: string;
	audioUrl: string;
}

export function buildTtsEmbedHtml(params: BuildTtsEmbedHtmlParams): string {
	const { embedTitle, audioUnsupported, voice, langLabel, text, audioUrl } =
		params;
	return `
      <div class="audio-embed" data-ude-embed="tts" style="margin:20px 0;padding:16px;border:1px solid var(--desktop-border-subtle);border-radius:8px;background:var(--desktop-surface-panel);color:var(--desktop-text-primary);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="width:32px;height:32px;background:rgb(var(--desktop-accent-rgb));border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M12 2C13.1 2 14 2.9 14 4V12C14 13.1 13.1 14 12 14C10.9 14 10 13.1 10 12V4C10 2.9 10.9 2 12 2ZM19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10H7V12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12V10H19Z"/>
            </svg>
          </div>
          <div>
            <p style="margin:0;font-weight:500;color:var(--desktop-text-primary);">${embedTitle}</p>
            <p style="margin:0;font-size:12px;color:var(--desktop-text-muted);">${voice} • ${langLabel}</p>
          </div>
        </div>
        <p style="margin:0 0 12px 0;font-size:14px;color:var(--desktop-text-secondary);font-style:italic;">
          "${text}"
        </p>
        <audio controls style="width:100%;">
          <source src="${audioUrl}" type="audio/wav">
          ${audioUnsupported}
        </audio>
      </div>
    `;
}
