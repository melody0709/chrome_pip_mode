# Changelog

All notable changes to this project will be documented in this file.

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
