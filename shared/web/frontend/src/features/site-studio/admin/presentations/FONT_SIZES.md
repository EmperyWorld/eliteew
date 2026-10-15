# Site Studio presentation typography

This is a source map for the shared frontend editor's font defaults and controls. It replaces the outdated copied font-size table; API persistence, PDF/export rendering and the complete presentation module still need their own audit.

## Source ownership

Template slide defaults live in [ollentiPresentationTemplates.ts](presentationEdit/ollentiPresentationTemplates.ts), including `ollenti2PresentationTemplate`. [PresentationEditPage.tsx](PresentationEditPage.tsx) composes the editor from `presentationEdit/` modules; the template array is no longer declared in that route file.

Use the template definitions for each slide's actual `titleFontSize` and `contentFontSize`. The old twelve-row table is not a reliable specification of current defaults. The [separate Olenti template editor](../../../../../../../../site-templates/olenti/src/pages/admin/presentations/FONT_SIZES.md) has its own source map.

## Editing and preview

[Typography controls](presentationEdit/PresentationEditSlideSettingsTypographyTab.tsx) update the selected slide's `titleFontSize` and `contentFontSize`. [Slide preview](presentationEdit/PresentationEditSlidePreview.tsx) reads those values and uses `2.5em` and `1.1em` respectively when they are absent. Template defaults are starting values, not a global font-size guarantee for every presentation.

The local [presentation stylesheet](presentation.css) defines the preview's A3 landscape dimensions as 1587 × 1123 CSS pixels and an aspect ratio of 420 / 297. This source check does not establish printed dimensions or PDF/export behavior.

## Related

- [Presentation editor composition](presentationEdit/usePresentationEditorCompose.ts).
- [Source template definitions](presentationEdit/ollentiPresentationTemplates.ts).
