# Olenti template presentation typography

This is a source map for the Olenti template editor. It replaces an outdated copied table; the complete presentation API, persistence, PDF/export and browser behavior remain outside this bounded entry review.

## Source ownership

The local [PresentationEditPage.tsx](PresentationEditPage.tsx) declares `ollenti2PresentationTemplate`, including each slide's `titleFontSize` and `contentFontSize`. Consult that array for current defaults instead of the former twelve-row Markdown table: several listed body sizes differ from the source.

The same page contains controls for the selected slide's typography and preview fallbacks of `2.5em` for a title and `1.1em` for body content. Slide values can differ from the initial template; no single font-size table describes every saved presentation.

The shared Site Studio frontend has an atomized editor with template definitions in a different file. Its [typography source map](../../../../../../shared/web/frontend/src/features/site-studio/admin/presentations/FONT_SIZES.md) must be checked separately when editing that application.

## Review limits

This entry verifies source locations and the named typography fields only. The former Markdown claims about font fallback ordering, automatic scaling and A3 export dimensions are not accepted by this review.

## Related

- [Local presentation editor](PresentationEditPage.tsx).
- [Olenti developer entry](../../../../README.md).
