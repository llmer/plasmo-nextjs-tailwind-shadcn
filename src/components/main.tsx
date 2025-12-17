/**
 * Main popup component for the calibration extension.
 */

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { RegionList } from "./RegionList";
import { TemplatePanel } from "./TemplatePanel";
import { OCRPreview } from "./OCRPreview";
import { ExportPanel } from "./ExportPanel";
import { ImportPanel } from "./ImportPanel";
import type { RegionName } from "../types";
import { getCalibrationConfig, addTemplate } from "../lib/storage";

type Tab = "regions" | "export";
type PanelType = "template" | "ocr" | null;

// Determine panel type based on region name
function getPanelType(regionName: string): PanelType {
  const ocrRegions: RegionName[] = ["balance", "bet_amount", "win_amount"];
  if (ocrRegions.includes(regionName as RegionName)) {
    return "ocr";
  }
  return "template";
}

/**
 * Crop an image to specified bounds and resize to output dimensions.
 *
 * @param dataUri - Source image as data URI
 * @param srcX, srcY, srcW, srcH - Source rectangle to crop (in source image pixels)
 * @param outW, outH - Output dimensions (may differ from source for DPR scaling)
 */
async function cropImage(
  dataUri: string,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  outW: number,
  outH: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        // Draw from source rect to output rect (scales if sizes differ)
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUri;
  });
}

export function Main() {
  const [activeTab, setActiveTab] = useState<Tab>("regions");
  const [overlayMode, setOverlayMode] = useState<"hidden" | "preview" | "calibrate">("hidden");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<PanelType>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);

  const handleSelectRegion = useCallback((name: string) => {
    setSelectedRegion(name);
    setOpenPanel(getPanelType(name));

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SELECT_REGION",
          regionName: name,
        });
      }
    });
  }, []);

  const handleDrawRegion = useCallback((name: string) => {
    setSelectedRegion(name);
    setOverlayMode("calibrate");

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "START_DRAW",
          regionName: name,
        });
      }
    });
  }, []);

  const handleToggleOverlay = useCallback(() => {
    const nextMode = overlayMode === "hidden" ? "preview" : overlayMode === "preview" ? "calibrate" : "hidden";
    setOverlayMode(nextMode);

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SET_OVERLAY_MODE",
          mode: nextMode,
        });
      }
    });
  }, [overlayMode]);

  const handleClosePanel = useCallback(() => {
    setOpenPanel(null);
  }, []);

  // Listen for region clicks from content script overlay
  useEffect(() => {
    const handleMessage = (message: { type: string; regionName?: string }) => {
      console.log("[Main] Received message:", message);
      if (message.type === "REGION_CLICKED" && message.regionName) {
        console.log("[Main] Opening panel for region:", message.regionName);
        handleSelectRegion(message.regionName);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    console.log("[Main] Message listener registered");
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [handleSelectRegion]);

  const handleCaptureAll = useCallback(async () => {
    setCapturing(true);
    setCaptureStatus("Getting screenshot...");

    try {
      // Get current config
      const config = await getCalibrationConfig();
      if (!config) {
        setCaptureStatus("Error: No config found");
        return;
      }

      // Request screenshot from background
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
      if (response.error) {
        throw new Error(response.error);
      }

      const screenshot = response.screenshot;
      if (!screenshot) {
        throw new Error("No screenshot received");
      }

      // Get device pixel ratio for coordinate scaling
      const dpr = window.devicePixelRatio || 1;

      // Find all template regions with non-zero bounds
      const templateRegions = Object.entries(config.regions).filter(
        ([, region]) =>
          region.type === "template" &&
          region.bounds_abs.w > 0 &&
          region.bounds_abs.h > 0
      );

      if (templateRegions.length === 0) {
        setCaptureStatus("No template regions with bounds defined");
        return;
      }

      // Capture each region
      let captured = 0;
      for (const [name, region] of templateRegions) {
        setCaptureStatus(`Capturing ${name}... (${captured + 1}/${templateRegions.length})`);

        try {
          // Crop to region bounds (accounting for device pixel ratio)
          // Source coordinates are scaled by DPR, output is CSS pixel size
          const cropped = await cropImage(
            screenshot,
            region.bounds_abs.x * dpr,
            region.bounds_abs.y * dpr,
            region.bounds_abs.w * dpr,
            region.bounds_abs.h * dpr,
            region.bounds_abs.w,  // Output at CSS pixel size
            region.bounds_abs.h
          );

          // Save template with name "visible" (overwrite if exists)
          await addTemplate(name, "visible", cropped);
          captured++;
        } catch (e) {
          console.error(`Failed to capture ${name}:`, e);
        }
      }

      setCaptureStatus(`Captured ${captured}/${templateRegions.length} templates`);
      setTimeout(() => setCaptureStatus(null), 3000);
    } catch (e) {
      setCaptureStatus(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setCapturing(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-3 p-3 w-[420px] min-h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Calibration</h1>
        <Button
          variant={overlayMode === "hidden" ? "outline" : overlayMode === "preview" ? "secondary" : "default"}
          size="sm"
          onClick={handleToggleOverlay}
        >
          {overlayMode === "hidden" && "Show Overlay"}
          {overlayMode === "preview" && "Preview Mode"}
          {overlayMode === "calibrate" && "Calibrate Mode"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-3 py-1.5 text-sm ${
            activeTab === "regions"
              ? "border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("regions")}
        >
          Regions
        </button>
        <button
          className={`px-3 py-1.5 text-sm ${
            activeTab === "export"
              ? "border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("export")}
        >
          Export/Import
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "regions" && (
          <div className="flex flex-col gap-3">
            {/* Capture All Templates */}
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCaptureAll}
                disabled={capturing}
                className="flex-shrink-0"
              >
                {capturing ? "Capturing..." : "Capture All Templates"}
              </Button>
              {captureStatus && (
                <span className="text-xs text-muted-foreground truncate">
                  {captureStatus}
                </span>
              )}
            </div>

            <RegionList
              onSelectRegion={handleSelectRegion}
              onDrawRegion={handleDrawRegion}
            />

            {/* Region detail panel */}
            {selectedRegion && openPanel === "template" && (
              <TemplatePanel
                regionName={selectedRegion}
                onClose={handleClosePanel}
              />
            )}

            {selectedRegion && openPanel === "ocr" && (
              <OCRPreview
                regionName={selectedRegion}
                onClose={handleClosePanel}
              />
            )}
          </div>
        )}

        {activeTab === "export" && (
          <div className="flex flex-col gap-4">
            <ExportPanel />
            <div className="border-t" />
            <ImportPanel />
          </div>
        )}
      </div>

      {/* Selected region indicator */}
      {selectedRegion && (
        <div className="mt-auto pt-2 border-t border-border text-sm flex items-center justify-between">
          <div>
            <span className="text-muted-foreground">Selected: </span>
            <span className="font-medium">{selectedRegion}</span>
            <span className="text-xs text-muted-foreground ml-2">
              ({getPanelType(selectedRegion)})
            </span>
          </div>
          {openPanel && (
            <button
              onClick={handleClosePanel}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close panel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
