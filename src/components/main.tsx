/**
 * Main popup component for the calibration extension.
 */

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { RegionList } from "./RegionList";
import { TemplatePanel } from "./TemplatePanel";
import { OCRPreview } from "./OCRPreview";
import { ExportPanel } from "./ExportPanel";
import { ImportPanel } from "./ImportPanel";
import type { RegionName } from "../types";

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

export function Main() {
  const [activeTab, setActiveTab] = useState<Tab>("regions");
  const [overlayMode, setOverlayMode] = useState<"hidden" | "preview" | "calibrate">("hidden");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<PanelType>(null);

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
