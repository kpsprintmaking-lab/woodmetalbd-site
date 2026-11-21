# Wood Metal brand colours

Taken from the Wood Metal banner. The site uses **only these colours**
(defined once as CSS variables at the top of `public/css/site.css`).

| Name | Hex | Used for |
|---|---|---|
| Gold-yellow | `#FECC2F` | main accent, buttons, Our Story card |
| Dark gold | `#C38820` | gradient ends, small labels, icons |
| Khaki | `#C1AB86` | thin lines under headings, muted tags |
| Black | `#111111` | text, dark bars, footer |
| Charcoal | `#343434` | secondary text, hover on dark buttons |
| Grey | `#666666` | small/secondary text |
| Light grey | `#D1D1D1` | borders, chevrons |
| Lighter grey | `#EDEDED` | light lines, chevrons |
| Off-white | `#F5F5F5` | soft backgrounds |
| White | `#FFFFFF` | page background |

Gold gradient (like the banner chevron): `#C38820 → #FECC2F → #C38820`.

Rules:
- Do not add any other colour (no green, blue, red, brown...). Error and success
  messages also use the palette (black text, gold border/icon).
- Black or white with transparency is fine for shadows and photo overlays.
- The only exception: the three polish swatches on product pages
  (`POLISH` in `src/strings.mjs`) show the real wood-finish colour of the furniture.
