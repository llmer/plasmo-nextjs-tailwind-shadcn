/**
 * Configuration schema for vision-based game automation.
 *
 * This module defines the calibration config schema used by both TypeScript (extension)
 * and Python (runtime). Changes here must be reflected in:
 * - src/config.py
 * - schemas/calibration-config.schema.json
 */

/**
 * Viewport or image dimensions.
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Percentage-based bounds (0.0 to 1.0 of viewport).
 * Used for portable calibration that works across different viewport sizes.
 */
export interface BoundsPct {
  x: number; // 0.0 to 1.0
  y: number;
  w: number;
  h: number;
}

/**
 * Absolute pixel bounds.
 */
export interface BoundsAbs {
  x: number; // pixels
  y: number;
  w: number;
  h: number;
}

/**
 * OCR configuration.
 */
export interface OCRConfig {
  backend?: "easyocr" | "tesseract"; // OCR backend (default: easyocr)
  // Tesseract-specific settings (used when backend="tesseract")
  preprocessing: "high_threshold" | "threshold" | "adaptive" | "none";
  psm: number; // Tesseract page segmentation mode (0-13)
  whitelist: string; // Characters to recognize
}

/**
 * A region definition from calibration config.
 */
export interface RegionConfig {
  bounds_pct: BoundsPct;
  bounds_abs: BoundsAbs;
  type: "template" | "ocr";
  templates?: Record<string, string>; // name -> base64 data URI
  ocr_config?: OCRConfig;
}

/**
 * Complete calibration configuration.
 */
export interface CalibrationConfig {
  version: string; // Must start with "1."
  calibration_viewport: Size;
  regions: Record<string, RegionConfig>;
  calibration_timestamp?: string; // ISO 8601
}

/**
 * Predefined region names for the game.
 */
export type RegionName =
  | "balance"
  | "bet_amount"
  | "win_amount"
  | "minigame_current_win"
  | "minigame_possible_win"
  | "spin_button"
  | "gamble_button"
  | "collect_button"
  | "red_card"
  | "black_card"
  | "bonus_indicator"
  | "autoplay_toggle"
  | "menu_button";

/**
 * Required regions that must be present in a valid config.
 */
export const REQUIRED_REGIONS: RegionName[] = [
  "balance",
  "bet_amount",
  "win_amount",
  "spin_button",
  "gamble_button",
  "collect_button",
];

/**
 * Optional regions that enhance functionality but aren't strictly required.
 */
export const OPTIONAL_REGIONS: RegionName[] = [
  "minigame_current_win",
  "minigame_possible_win",
  "red_card",
  "black_card",
  "bonus_indicator",
  "autoplay_toggle",
  "menu_button",
];

/**
 * All predefined region names.
 */
export const ALL_REGIONS: RegionName[] = [...REQUIRED_REGIONS, ...OPTIONAL_REGIONS];

/**
 * Default OCR configuration for value extraction.
 */
export const DEFAULT_OCR_CONFIG: OCRConfig = {
  backend: "easyocr", // Deep learning OCR - handles varied backgrounds without preprocessing
  preprocessing: "high_threshold", // Tesseract fallback setting
  psm: 6, // Tesseract page segmentation mode
  whitelist: "0123456789.,",
};

/**
 * Convert percentage bounds to absolute pixel bounds.
 */
export function toAbsolute(pct: BoundsPct, viewport: Size): BoundsAbs {
  return {
    x: Math.round(pct.x * viewport.width),
    y: Math.round(pct.y * viewport.height),
    w: Math.round(pct.w * viewport.width),
    h: Math.round(pct.h * viewport.height),
  };
}

/**
 * Convert absolute pixel bounds to percentage bounds.
 */
export function toPercentage(abs: BoundsAbs, viewport: Size): BoundsPct {
  return {
    x: abs.x / viewport.width,
    y: abs.y / viewport.height,
    w: abs.w / viewport.width,
    h: abs.h / viewport.height,
  };
}

/**
 * Validate a calibration config, returning validation errors.
 */
export function validateConfig(config: CalibrationConfig): string[] {
  const errors: string[] = [];

  // Validate version format
  if (!config.version.startsWith("1.")) {
    errors.push(`version: must start with '1.', got '${config.version}'`);
  }

  // Validate viewport dimensions
  if (config.calibration_viewport.width <= 0) {
    errors.push(
      `calibration_viewport.width: must be positive, got ${config.calibration_viewport.width}`
    );
  }
  if (config.calibration_viewport.height <= 0) {
    errors.push(
      `calibration_viewport.height: must be positive, got ${config.calibration_viewport.height}`
    );
  }

  // Check required regions
  const regionNames = new Set(Object.keys(config.regions));
  const missingRegions = REQUIRED_REGIONS.filter((r) => !regionNames.has(r));
  if (missingRegions.length > 0) {
    errors.push(`regions: missing required regions: ${missingRegions.sort().join(", ")}`);
  }

  // Validate each region
  for (const [name, region] of Object.entries(config.regions)) {
    const prefix = `regions.${name}`;

    // Validate type
    if (region.type !== "template" && region.type !== "ocr") {
      errors.push(`${prefix}.type: must be 'template' or 'ocr', got '${region.type}'`);
    }

    // Validate bounds_pct ranges
    for (const field of ["x", "y", "w", "h"] as const) {
      const val = region.bounds_pct[field];
      if (val < 0 || val > 1) {
        errors.push(`${prefix}.bounds_pct.${field}: must be 0.0-1.0, got ${val}`);
      }
    }

    // Validate bounds_abs are non-negative
    for (const field of ["x", "y", "w", "h"] as const) {
      const val = region.bounds_abs[field];
      if (val < 0) {
        errors.push(`${prefix}.bounds_abs.${field}: must be non-negative, got ${val}`);
      }
    }

    // Validate OCR config if present
    if (region.ocr_config) {
      const ocr = region.ocr_config;
      if (!["threshold", "adaptive", "none"].includes(ocr.preprocessing)) {
        errors.push(
          `${prefix}.ocr_config.preprocessing: must be 'threshold', 'adaptive', or 'none', got '${ocr.preprocessing}'`
        );
      }
      if (ocr.psm < 0 || ocr.psm > 13) {
        errors.push(`${prefix}.ocr_config.psm: must be 0-13, got ${ocr.psm}`);
      }
    }
  }

  return errors;
}

/**
 * Create an empty calibration config with default structure.
 */
export function createEmptyConfig(viewport: Size): CalibrationConfig {
  const regions: Record<string, RegionConfig> = {};

  // Create empty regions for all predefined names
  for (const name of ALL_REGIONS) {
    const isOCR = ["balance", "bet_amount", "win_amount"].includes(name);
    regions[name] = {
      bounds_pct: { x: 0, y: 0, w: 0, h: 0 },
      bounds_abs: { x: 0, y: 0, w: 0, h: 0 },
      type: isOCR ? "ocr" : "template",
      ...(isOCR ? { ocr_config: { ...DEFAULT_OCR_CONFIG } } : {}),
    };
  }

  return {
    version: "1.0",
    calibration_viewport: viewport,
    regions,
    calibration_timestamp: new Date().toISOString(),
  };
}
