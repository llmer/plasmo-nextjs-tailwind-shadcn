/**
 * Chrome storage helpers for calibration configuration.
 *
 * Uses chrome.storage.local for persistent storage across sessions.
 * Templates are stored as base64 data URIs within the config.
 */

import type { CalibrationConfig, RegionConfig } from "../types";
import { createEmptyConfig } from "../types";

const STORAGE_KEY = "calibration_config";

/**
 * Get the current calibration config from storage.
 */
export async function getCalibrationConfig(): Promise<CalibrationConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

/**
 * Save the calibration config to storage.
 */
export async function setCalibrationConfig(
  config: CalibrationConfig
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

/**
 * Get a specific region from the config.
 */
export async function getRegion(name: string): Promise<RegionConfig | null> {
  const config = await getCalibrationConfig();
  if (!config) return null;
  return config.regions[name] || null;
}

/**
 * Update a specific region in the config.
 * Creates a new config if none exists.
 */
export async function setRegion(
  name: string,
  region: RegionConfig
): Promise<void> {
  let config = await getCalibrationConfig();
  if (!config) {
    // Initialize new config with current viewport
    config = createEmptyConfig({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }
  config.regions[name] = region;
  config.calibration_timestamp = new Date().toISOString();
  await setCalibrationConfig(config);
}

/**
 * Delete a region from the config.
 */
export async function deleteRegion(name: string): Promise<void> {
  const config = await getCalibrationConfig();
  if (!config) return;
  delete config.regions[name];
  config.calibration_timestamp = new Date().toISOString();
  await setCalibrationConfig(config);
}

/**
 * Clear all calibration data.
 */
export async function clearCalibration(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

/**
 * Get the size of the stored config in bytes.
 */
export async function getStorageSize(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const json = JSON.stringify(result[STORAGE_KEY] || {});
  return new Blob([json]).size;
}

/**
 * Update the calibration viewport size.
 */
export async function updateViewport(
  width: number,
  height: number
): Promise<void> {
  let config = await getCalibrationConfig();
  if (!config) {
    config = createEmptyConfig({ width, height });
  } else {
    config.calibration_viewport = { width, height };
    config.calibration_timestamp = new Date().toISOString();
  }
  await setCalibrationConfig(config);
}

/**
 * Add a template to a region.
 */
export async function addTemplate(
  regionName: string,
  templateName: string,
  dataUri: string
): Promise<void> {
  const config = await getCalibrationConfig();
  if (!config || !config.regions[regionName]) {
    throw new Error(`Region ${regionName} not found`);
  }

  const region = config.regions[regionName];
  if (!region.templates) {
    region.templates = {};
  }
  region.templates[templateName] = dataUri;
  config.calibration_timestamp = new Date().toISOString();
  await setCalibrationConfig(config);
}

/**
 * Remove a template from a region.
 */
export async function removeTemplate(
  regionName: string,
  templateName: string
): Promise<void> {
  const config = await getCalibrationConfig();
  if (!config || !config.regions[regionName]) return;

  const region = config.regions[regionName];
  if (region.templates) {
    delete region.templates[templateName];
    config.calibration_timestamp = new Date().toISOString();
    await setCalibrationConfig(config);
  }
}
