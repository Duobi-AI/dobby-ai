# Design QA: Dobby popup, selected visual direction 2

**Source visual truth:** `/Users/zhongnansu/.codex/generated_images/01a0d1f9-a63d-7a70-9940-b3757617dcda/exec-0570a260-9f71-4731-9518-4296ce48f869.png`

**Implementation screenshots:** `/tmp/dobby-popup-audit-2026-09-24/final/option2-off.png` and `/tmp/dobby-popup-audit-2026-09-24/final/option2-on.png`

**Viewport/state:** Dobby popup at 268 x 500 CSS pixels, device scale factor 1. Off comparison state: dark theme, Dobby Off, both child preferences On (checked) and disabled. On state confirms restored interaction. Usage values are disposable mock data.

**Dimensions and normalization:** source image is 919 x 1712 pixels (2.64:1 image density relative to the 268 CSS-pixel target width); it was scaled proportionally to 268 x 499 for comparison. The implementation captures are 268 x 475 and 268 x 475 CSS pixels at device scale factor 1. The comparison canvas aligns the left edge and top of both popup captures without stretching either. The 24-pixel height difference is primarily the intentional removal of the master “Off” text label and generated-copy spacing; all controls remain visible.

**Full-view comparison:** `/tmp/dobby-popup-audit-2026-09-24/final/full-comparison.png`

**Focused comparison:** `/tmp/dobby-popup-audit-2026-09-24/final/focused-comparison.png` compares the master and feature-control region in the same Off state.

## Comparison history

- First visual pass used bordered feature cards. Side-by-side comparison showed this differed from the selected flat list with icon tiles and separators. Changed `.feature-row` to use the base surface and separators, then rebuilt and recaptured both states.
- Final full and focused comparisons show the selected list hierarchy and controls aligned. The master “Off” text in the generated visual was removed in line with the user's direction that the toggle itself should convey its state. Child check positions retain their saved preferences while disabled styling communicates that they cannot currently be changed.

## Fidelity surfaces

- **Typography:** Existing system sans-serif and popup sizes retained. Labels remain readable at the natural extension width.
- **Spacing and rhythm:** 268-pixel popup width preserved; feature rows use consistent separators, icon tiles, and spacing. The shorter final height is intentional as documented above.
- **Colors and tokens:** Existing warm amber and dark theme tokens are used. Disabled feature rows are visually subdued.
- **Images and icons:** Existing Dobby logo asset retained. Feature iconography uses Tabler's crop and message icons rather than hand-drawn substitutes.
- **Copy and content:** Existing feature names and utility content retained. No helper sentence, saved-state label, or paused badge is shown.

## Findings

No actionable P0, P1, or P2 differences remain. Keyboard focus appearance was not included in this visual comparison; the toggles remain native labeled checkboxes and the child fieldset retains disabled semantics.

## Follow-up polish

None required for this selected direction.

final result: passed
