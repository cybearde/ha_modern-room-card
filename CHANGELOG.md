# Changelog

All notable changes to this project will be documented here.

## 1.0.1 - 2026-09-06

- Improved compact-row icon alignment by reducing the default entity top offset from -12 px to zero.

## 1.0.0 - 2026-09-06

- Fixed info-entity gestures also activating the header and delegated actions to Home Assistant for current action and confirmation support.
- Fixed gesture options remaining stale after configuration changes; added independent pointer/keyboard handling and cleanup on removal.
- Kept nested-card instances across Home Assistant updates and skipped unrelated parent renders while preserving template updates.
- Fixed explicit icons, missing entities/attributes, synchronous configuration errors, and style-template error recovery.
- Fixed theme-variable cycles in conditional foregrounds and distinguished Default from None in action selectors.
- Repaired shadow-DOM access in live editor tests, made missing authentication fail explicitly, and added desktop/mobile browser regressions.

- Breaking: removed top-level `entities` and `content_alignment`; normal entities now live exclusively in `rows`.
- Unified the visual editor around rows so adding a row can no longer hide another entity collection.
- Added a native compact layout preset for dense room cards.
- Centered compact info entities within the header and made compact outer padding uniform.
- Added configurable widths for empty layout slots, replacing fake transparent entities.
- Updated visual-editor dropdowns for Home Assistant's current `ha-select` API.
- Prevented entity-picker and configuration state from leaking when an editor is reused for another card.
- Grouped the main entity and icon pickers under one shared label so their controls align without positional offsets.
- Redesigned the visual editor with distinct, accented panels for the main entity, info entities, and rows.
- Added a title-size slider, content-size presets, and configurable title overflow behavior.
- Let title height follow its configured font size and added right-side breathing room for header info entities.
- Moved the info-entity row into the title flex layout so header spacing and alignment apply as one unit.
- Increased compact padding to 8 px and let the main state badge use Home Assistant's native font metrics.
- Clarified the visual title and entity-name fields and show custom row names in collapsed editor panels.
- Added a full-width main-title text field below the entity and icon pickers, mapped directly to the YAML `title` attribute.
- Replaced obsolete, unregistered `ha-textfield` controls with Home Assistant's current `ha-input` component.
- Added first-class conditional appearance rules with priority selection, entity-derived colors, background-only
  opacity, reduced-motion-aware transitions, monitored condition entities, and complete visual-editor controls.
- Made the visual editor responsive down to narrow mobile widths and added safe space above Home Assistant's footer.
- Hardened card layout for RTL, long text, larger typography, card-scoped conditional foregrounds, and keyboard focus.
- Enabled Home Assistant state-aware coloring for the main entity icon by default, with YAML and visual-editor opt-out.
