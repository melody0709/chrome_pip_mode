# Changelog

## [1.0.2] - 2026-04-21

### Changed
- Fixed viewport tier detection by using absolute window physical dimensions to avoid system scaling/DPI zoom issues
- Updated MAX_VIEWPORT_RATIO from 0.38 to 0.50
- Refined tiered thresholds for better multiscreen behaviors (MEDIUM is now 50%-70%)
- Fixed an issue where manual resizing of the floating player wouldn't correctly save the new width ratio to the active tier, causing tiers to overwrite each other's memory
- Fixed the anchoring distance calculation so the floating player maintains its absolute distance from the right and bottom edges during window scaling and page zooming
- Updated storage schema to v6 with automated state migration

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-04-20

### Added
- **Multi-Tier Width Ratio**: Implemented four viewport width tiers (MAX/WIDE/MEDIUM/SMALL) based on screen physical width percentage.
  - MAX (85%-100%): Full screen mode
  - WIDE (70%-85%): Wide window mode  
  - MEDIUM (55%-70%): Medium/split screen mode
  - SMALL (≤55%): Small window mode
- **Independent Ratio Memory**: Each tier now maintains its own `widthRatio`, allowing different floating player sizes for different window sizes.
- **Storage Schema v5**: Upgraded from v4 to v5 to support multi-tier width ratios with automatic migration from v3/v4.

### Changed
- **Adaptive Width Calculation**: When browser window is resized, the floating player now uses the corresponding tier's `widthRatio` instead of a single global ratio.
- **Default Ratios**: Set default ratios for each tier (MAX: 20%, WIDE: 22%, MEDIUM: 25%, SMALL: 30%).

## [1.0.0] - 2026-04-20

### Changed
- **Geometry Optimization**: Decoupled `widthRatio` from boundary clamping to ensure the player "remembers" its user-defined relative size even after window resizing.
- **Zoom Adaptability**: Implemented dynamic `MIN_WIDTH` calculation using `window.devicePixelRatio`. This prevents the player from becoming physically massive at high page zoom levels (e.g., 500%).
- **Vertical Alignment**: Fixed the issue where the floating player would drift upwards when zooming in. The distance from the bottom is now strictly maintained.
- **Layering & Clipping (Bilibili)**: Implemented a recursive ancestor `z-index` and `overflow` modification strategy for Bilibili. The floating player now correctly overlays all page elements, including side-nav buttons (Customer Service, etc.).
- **CSS Reset**: Injected `min-width: 0 !important` and `min-height: 0 !important` to override site-specific container constraints that caused aspect ratio distortion at extreme zoom levels.
- **Refactoring**: Promoted ancestor visibility logic to a shared utility for better site-specific integration.

## [0.3.0]
- Initial functional version with basic dragging and four-corner resizing for Bilibili and YouTube.
