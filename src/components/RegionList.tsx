/**
 * List of all predefined regions with status indicators.
 */

import { useEffect, useState } from "react";

import type { CalibrationConfig, RegionName } from "../types";
import { getCalibrationConfig } from "../lib/storage";
import { RegionItem } from "./RegionItem";

/**
 * Predefined regions with metadata.
 */
const PREDEFINED_REGIONS: Array<{
  name: RegionName;
  type: "template" | "ocr";
  required: boolean;
  description: string;
}> = [
  { name: "balance", type: "ocr", required: true, description: "Current credit balance" },
  { name: "bet_amount", type: "ocr", required: true, description: "Current bet value" },
  { name: "win_amount", type: "ocr", required: true, description: "Current win display" },
  { name: "spin_button", type: "template", required: true, description: "Main spin button" },
  { name: "gamble_button", type: "template", required: true, description: "GAMBLE button" },
  { name: "collect_button", type: "template", required: true, description: "COLLECT button" },
  { name: "minigame_current_win", type: "ocr", required: false, description: "Minigame current win" },
  { name: "minigame_possible_win", type: "ocr", required: false, description: "Minigame possible win" },
  { name: "red_card", type: "template", required: false, description: "Red card choice" },
  { name: "black_card", type: "template", required: false, description: "Black card choice" },
  { name: "bonus_indicator", type: "template", required: false, description: "FREE SPINS" },
  { name: "autoplay_toggle", type: "template", required: false, description: "Autoplay toggle" },
  { name: "menu_button", type: "template", required: false, description: "Menu button" },
];

interface RegionListProps {
  onSelectRegion: (name: string) => void;
  onDrawRegion: (name: string) => void;
}

export function RegionList({ onSelectRegion, onDrawRegion }: RegionListProps) {
  const [config, setConfig] = useState<CalibrationConfig | null>(null);

  useEffect(() => {
    loadConfig();
    // Listen for storage changes
    const handleChange = () => loadConfig();
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  async function loadConfig() {
    const cfg = await getCalibrationConfig();
    setConfig(cfg);
  }

  function getRegionStatus(name: string): "pending" | "captured" | "error" {
    if (!config?.regions[name]) return "pending";
    const region = config.regions[name];
    // Check if bounds are set (w > 0 means it's been calibrated)
    if (region.bounds_pct.w === 0) return "pending";
    return "captured";
  }

  // Count progress
  const requiredRegions = PREDEFINED_REGIONS.filter((r) => r.required);
  const capturedRequired = requiredRegions.filter(
    (r) => getRegionStatus(r.name) === "captured"
  ).length;
  const totalCaptured = PREDEFINED_REGIONS.filter(
    (r) => getRegionStatus(r.name) === "captured"
  ).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
        <span>Regions</span>
        <span>
          {capturedRequired}/{requiredRegions.length} required, {totalCaptured}/{PREDEFINED_REGIONS.length} total
        </span>
      </div>
      <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-1">
        {PREDEFINED_REGIONS.map((region) => (
          <RegionItem
            key={region.name}
            name={region.name}
            type={region.type}
            required={region.required}
            description={region.description}
            status={getRegionStatus(region.name)}
            onSelect={() => onSelectRegion(region.name)}
            onDraw={() => onDrawRegion(region.name)}
          />
        ))}
      </div>
    </div>
  );
}
