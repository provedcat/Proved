# Proved Design System

> **Role:** executable design contract for Codex / OpenDesign / frontend agents.
> **Source of truth:** `design/rules-inventory.json`, audited from Notion World Model + merged GitHub implementation + confirmed Proved conversation decisions.
> **Coverage:** 50/50 active rules included · 0 unresolved conflicts.
> Do not hand-delete or weaken a rule here. Update the World Model/inventory first, then regenerate this contract.

## Visual thesis

**Editorial Pet Data.** Proved combines the editorial confidence of a specialist pet magazine with the precision of a data tool. The base chrome is calm and systematic; character comes from typography, data, physical metaphors, and interactions that explain something real.

AI-looking design is not avoided by deleting all visual character. Avoid generic card mosaics, gratuitous gradients, oversized pills, repeated shadow containers, and decorative filler. At the same time, do not flatten meaningful semantic color or Proved-specific signature visuals.

## Source precedence

1. Approved **Current Truth** in the Proved Notion World Model.
2. Newer **merged GitHub implementation** and current main-branch behavior.
3. Explicitly confirmed **current Proved conversation decisions**.
4. Historical PRs/conversations only as superseded evidence.

## Working model

- **Utility layer:** search, input, filters, navigation, calculations — fast, literal, restrained.
- **Editorial layer:** explanation, comparison, product identity, result reading — stronger composition and typography.
- **Signature layer:** data/interaction metaphors that make Proved memorable — only when they encode product meaning.

## Foundation & Brand

- **[PD-001] MUST · shipped · global** — Use SUIT Variable as the default UI typeface. Load the real variable font resource on every standardized page and do not rely on synthetic browser weights.
- **[PD-002] MUST · shipped · global** — Use Proved Blue #3568FF for brand chrome, page titles, and primary actions. Page titles must not be black.
- **[PD-003] MUST · shipped · global** — Use the canonical neutral palette: background #F5F7FA, text #727B8B, soft text #9AA1AD, divider #DCE2EA, functional white #FFFFFF.
- **[PD-004] MUST · shipped · data surfaces** — Preserve semantic data colors: cat dry #B85A00, cat wet #1F5CC4, dog dry #9A5B34, dog wet #388255, water #2F858C, Ca:P #5D537F. These colors communicate meaning and are not decorative accents.
- **[PD-005] MUST · shipped · global** — Use gray for secondary information, Proved Blue for important product/interpretation emphasis, short orange treatment for waiting or caution, and red only when a genuine error/danger state requires it.
- **[PD-006] SHOULD · shipped · global** — Reuse established CSS tokens before introducing a new color. A new color must have a semantic/data/state role, not merely fill visual emptiness.
- **[PD-007] MUST · shipped · global header** — Use the final PROVED wordmark SVG at icons/proved-main-logo.svg in the shared header. Preserve legibility and the O-circle / V-check verification gesture.
- **[PD-008] SHOULD · shipped · icons and pictograms** — Pictograms are monochrome by default and follow the surface foreground color. Multi-color treatment is reserved for semantic data visualization, not decoration.

## Shared Composition & Components

- **[PD-009] MUST · shipped · standardized pages** — Use the shared geometry contract: max width 1124px, desktop gutter 28px, content inset 40px, reading max 980px, hero max 760px, header 80px, subnav 90px, hero start/end 72px/56px unless a documented page-specific composition overrides it.
- **[PD-010] MUST · shipped · standardized pages** — Use the shared title/copy hierarchy: title clamp(48px,5.4vw,72px), weight 800, line-height 1.04, tracking -.055em; supporting copy 17px with 1.75 leading. Mobile <=720 uses title clamp(44px,12vw,52px) and copy 15px, except documented page-specific exceptions.
- **[PD-011] MUST · shipped · global** — Render header, section sub-navigation, and footer from the shared system rather than page-local lookalikes. Preserve common content origins and safe-area behavior.
- **[PD-012] MUST · shipped · section subnav** — Section sub-navigation is for navigation only. Keep the visible section tabs in one shared row/grid and put explanations inside the destination page body, not in the tab chrome.
- **[PD-013] MUST · shipped · global** — Default to sections, lists, columns, whitespace, and thin dividers instead of generic dashboard card mosaics. A card/container is justified only when the container itself carries interaction, grouping, or document meaning.
- **[PD-014] MUST · shipped · buttons and controls** — Primary controls should read as solid rectangular actions with white labels; secondary actions can be text/underline/outline. Avoid gratuitous pill shapes and large radii as a default style.
- **[PD-015] SHOULD · shipped · global** — Keep shadows and elevation minimal. Use depth only when it explains a physical interaction metaphor such as the folder stack, dropdown/modal layering, or a temporary active/hover state.
- **[PD-016] SHOULD · shipped · numbered sections** — Use editorial 01/02-style numbering when it improves scanning. The number is supporting hierarchy, often muted, and its grid axis should align with the title and following content rather than behave as a badge.
- **[PD-017] SHOULD · partial · modals and overlays** — Close actions must be visually unambiguous and compact; use the established ⓧ/close affordance rather than decorative icon containers unless the component requires otherwise.

## Responsive, Accessibility & Motion

- **[PD-018] MUST · shipped · global** — Design responsive compositions by breakpoint; do not merely shrink the desktop layout. If a 2-column composition becomes cramped, restructure it rather than compressing text and controls.
- **[PD-019] MUST · shipped · viewport and chrome** — When viewport-fit=cover is used, shared header and relevant content must respect safe-area insets without changing ordinary-browser geometry when inset values are zero.
- **[PD-020] MUST · shipped · global** — Do not permit accidental horizontal page overflow. Growing taxonomies or long labels should wrap or scroll inside the owning component rather than expanding the page or moving neighboring structures.
- **[PD-021] MUST · shipped · touch UI** — Touch targets must be at least 44px where applicable, but accessibility minimums must never override deliberately larger mobile targets such as 62–64px entry options/login controls.
- **[PD-022] MUST · shipped · global** — Motion is functional and restrained: short transitions/reveals, stable geometry, and no decorative continuous motion. Support prefers-reduced-motion; data graphics become static when motion is reduced.
- **[PD-023] MUST · partial · design changes** — Design PRs should receive actual visual verification when the runtime allows it. Minimum reference widths for major responsive changes: 1440, 1024, 980, 768, 390, 375; check overflow, hierarchy, line breaks, states, footer, and safe area.

## Entry / Home

- **[PD-024] MUST · shipped · desktop home entry** — On desktop entry, the editorial statement is the dominant visual and the action region is secondary; preserve a clear primary/secondary split rather than two equal SaaS panels.
- **[PD-025] MUST · shipped · tablet 761-980** — At 761–980px, stack the hero into one column and let the action region use its own two-column internal composition where appropriate; do not force the narrow desktop two-column hero.
- **[PD-026] MUST · shipped · mobile <=760** — On mobile, use a one-column entry composition and remove the desktop outer vertical frame. On very small mobile <=380px, reduce the number column while preserving the content alignment/indent relationship.
- **[PD-027] MUST · shipped · entry headings** — Bind number width, heading gap, and following content indent through shared variables/calculation. Avoid separately hard-coded margin-left values that can drift. Keep 01/02 lower in hierarchy than the heading.
- **[PD-028] MUST · shipped · entry action area** — Do not tint the action column into a generic SaaS hero+form panel. Let the page surface, typography, and divider structure create separation.

## Condition Finder

- **[PD-029] MUST · shipped · folder stage** — Condition folders occupy the same x/y position and size in a fixed overlap stage. Selecting a folder means it moves to the front on the z-axis, not that it moves vertically to the top of the document.
- **[PD-030] MUST · shipped · folder body** — Keep all tabs visible/clickable while one folder is frontmost. Desktop front body height is approximately clamp(260px,34vh,320px); long tag sets scroll inside the folder. Preserve the separate mobile height strategy and do not grow the whole page to fit taxonomy growth.
- **[PD-031] MUST · shipped · folder tab** — Selected counts have no white badge. Count and tab label share color, size, and weight, with a tight 4px gap so the count is part of the label hierarchy, not a separate status chip.
- **[PD-032] MUST · shipped · tags** — Tags are direct toggles: selecting applies the condition, selecting the same tag again removes it. Results use AND/intersection semantics across selected tags; avoid extra helper copy when interaction is self-explanatory.

## Food Detail

- **[PD-033] MUST · shipped · Product Tag Blob** — Product Tag Blob is a Proved signature visual fingerprint derived from product tags, placed near product identity as a visual summary rather than a decorative hero.
- **[PD-034] MUST · shipped · Product Tag Blob rendering** — The current Blob is round-dominant and reads as one organic mass: deterministic per product, up to 8 representative tags, 5+ may use a stable central lobe, local contact blending preserves each lobe color without white wash, labels are white, mobile scale is reduced, and no decorative persistent animation is added.
- **[PD-035] MUST · shipped · basic info** — Keep basic product information dense and predictable: 3x2 six-cell grid on desktop and 2x3 on mobile where applicable. Preserve the cell even when data is absent and say 확인되지 않음/— instead of collapsing the structure.
- **[PD-036] MUST · shipped · mobile key metrics** — On mobile, present energy, water, and Ca:P as a compact 3-column metric strip and use their semantic colors. These are a quick data scan, not three oversized cards.
- **[PD-037] MUST · shipped · mobile nutrition standards** — Prioritize the product's registered and DM numeric values over repeated AAFCO/FEDIAF labels. Keep guideline comparison compact and avoid horizontal scrolling; omit guideline placeholders for nutrients that are not comparable.

## Food Compare

- **[PD-038] MUST · shipped · comparison identity** — Compare exactly two products. Use real brand/product identifiers in table and explanatory labels; for same-brand products emphasize the differing product-name portion instead of anonymous A/B labels when possible.
- **[PD-039] MUST · shipped · interpretation** — Do not visually declare a winner or use red to manufacture superiority. Numbers/supporting information stay restrained; key interpretation may use Proved Blue. Missing evidence is labeled 정보 부족/비교할 정보가 부족합니다 rather than guessed.

## Calculator & Result Artifacts

- **[PD-040] MUST · shipped · flow** — Calculator DOM, visual, and reading order is 01 급여 중인 사료 → 02 반려동물 정보 → 03 급여 비율 → 04 계산 결과. Preserve this shared cat/dog order.
- **[PD-041] MUST · shipped · result hierarchy** — In calculation results, per-food grams are the protagonist and calories are secondary. Interactive results retain the full useful Ca/P and water analysis even when the share artifact is simplified.
- **[PD-042] MUST · shipped · saved/share artifact** — Saved/share feeding output is a concise document on a white background. It is a summary, not a duplicate of every on-screen analysis. Do not reintroduce the superseded warm-paper background or PV label.
- **[PD-043] MUST · shipped · result typography** — Create reading order through size, weight, contrast, and spacing: grams strongest; kcal/ratios secondary; explanatory copy lower contrast. Avoid both all-one-blue monotony and extreme type-size jumps that make the document feel unbalanced.

## Feed Reading & Editorial

- **[PD-044] MUST · shipped · intro and guide** — The PROVED 데이터 읽기 intro is centered and uses natural semantic paragraphs without forced <br> line breaks; text-wrap may balance lines. Use explanatory pictograms/graphics only when they help understanding, with reduced-motion fallback.
- **[PD-045] MUST · shipped · archive editorial** — Editorial titles/headings remain Proved Blue. Prefer CSS/SVG charts, diagrams, and infographics that explain DM/NFE/energy concepts; do not use decorative photography merely to fill space. Reference images guide graphic communication, not the website's brand palette/layout.

## Feed Registration

- **[PD-046] MUST · shipped · registration UI** — Registration uses the shared SUIT/title contract; the English kicker is FEED REGISTRATION. During the roughly 13-second research flow, disable repeat submission, show concrete progress stages, and use a short orange attention message rather than blaming user impatience.

## Signature Visuals & Trust

- **[PD-047] MUST · shipped · global** — Keep base chrome restrained, but permit a memorable visual/interaction when it encodes data or behavior. Approved families include z-axis folders, Product Tag Blob, explanatory infographics/pictograms, and document-like result artifacts. Do not add spectacle that has no product meaning.
- **[PD-048] MUST · shipped · data and evaluation** — Proved does not impose an opaque absolute best-food score. Show criteria, source/evidence, and calculation logic; where information is missing, say 정보 부족/확인되지 않음 instead of inventing certainty.

## Future Output

- **[PD-049] MUST · queued · My Score** — Future My Score should feel like a user-authored score document: the user's chosen criteria/weights are visually primary, the evidence/contribution is inspectable, and the output can be saved/shared without looking like an official Proved absolute rating.

## Governance

- **[PD-050] MUST · building · design contract** — DESIGN.md is a compiled execution contract from the audited rule inventory, not a manually curated source of truth. Every active rule ID must appear in DESIGN.md; duplicate IDs, source-less active rules, or unresolved conflicts fail the design contract test.

## Current canonical tokens

```css
:root {
  --proved-color-blue: #3568FF;
  --proved-color-bg: #F5F7FA;
  --proved-color-text: #727B8B;
  --proved-color-text-soft: #9AA1AD;
  --proved-color-line: #DCE2EA;
  --proved-color-white: #FFFFFF;

  --proved-cat-dry: #B85A00;
  --proved-cat-wet: #1F5CC4;
  --proved-dog-dry: #9A5B34;
  --proved-dog-wet: #388255;
  --proved-water: #2F858C;
  --proved-calcium-phosphorus: #5D537F;
}
```

## Design task protocol

Before editing a Proved surface:

1. Classify the surface: **Utility / Editorial / Signature / Output artifact**.
2. Identify the user's decision or action on that screen.
3. Preserve all applicable `PD-*` rules from this contract.
4. Choose at most the amount of visual emphasis the task can justify; do not add effects merely to make the screen feel designed.
5. Preserve existing product behavior unless the task explicitly changes behavior.
6. Render and inspect responsive states whenever browser tooling is available.
7. For a design PR, report which rule IDs were intentionally affected.

## Anti-pattern check

Reject or revise a design if it:

- looks like a generic dashboard assembled from interchangeable cards;
- removes semantic colors solely to make the palette more uniform;
- creates hierarchy mainly through boxes, radius, shadows, or badges;
- invents a new decorative metaphor instead of strengthening an existing Proved one;
- compresses desktop layouts until text or controls become cramped instead of changing composition;
- hides missing data behind confident visual scoring;
- changes the common header/subnav/layout contract for a local page without a documented reason;
- claims visual verification when screenshots/browser rendering were not actually performed.

## Superseded directions — do not reintroduce

- Old #2F6FED / #234FB8 / navy-first global palette.
- Blanket removal of semantic feed/nutrition colors.
- Warm ivory background for the current saved feeding image.
- `PV / DAILY FEEDING PLAN` naming.
- Treating condition finder or the final wordmark as unimplemented.
- Interpreting 'avoid AI-looking UI' as 'remove all expressive visual devices'.

## Coverage contract

`tests/design-rules.test.js` must pass before this file is considered synchronized. The test verifies:

- every active inventory rule ID appears in this file;
- no active rule ID is duplicated in the inventory;
- every active rule has at least one source;
- the inventory has zero unresolved conflicts;
- the coverage count matches the number of active rules.
