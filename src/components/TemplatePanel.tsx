/**
 * Template capture and management panel.
 *
 * Allows capturing screenshots and cropping them to region bounds
 * to create template images for template matching.
 */

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RegionConfig } from "../types";
import { getRegion, addTemplate, removeTemplate } from "../lib/storage";

interface TemplatePanelProps {
  regionName: string;
  onClose: () => void;
}

export function TemplatePanel({ regionName, onClose }: TemplatePanelProps) {
  const [region, setRegionState] = useState<RegionConfig | null>(null);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [newTemplateName, setNewTemplateName] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRegion();
  }, [regionName]);

  async function loadRegion() {
    const r = await getRegion(regionName);
    setRegionState(r);
    setTemplates(r?.templates || {});
  }

  const captureTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      setError("Enter a template name first");
      return;
    }

    if (!region || region.bounds_pct.w === 0) {
      setError("Region bounds not set. Draw the region first.");
      return;
    }

    setCapturing(true);
    setError(null);

    try {
      // Request screenshot from background
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });

      if (response.error) {
        throw new Error(response.error);
      }

      const screenshot = response.screenshot;
      if (!screenshot) {
        throw new Error("No screenshot received");
      }

      // Crop to region bounds (accounting for device pixel ratio)
      // Source coordinates are scaled by DPR, output is CSS pixel size
      const dpr = window.devicePixelRatio || 1;
      const cropped = await cropImage(
        screenshot,
        region.bounds_abs.x * dpr,
        region.bounds_abs.y * dpr,
        region.bounds_abs.w * dpr,
        region.bounds_abs.h * dpr,
        region.bounds_abs.w,  // Output at CSS pixel size
        region.bounds_abs.h
      );

      // Save template
      await addTemplate(regionName, newTemplateName.trim(), cropped);

      // Reload region to get updated templates
      await loadRegion();
      setNewTemplateName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  }, [newTemplateName, region, regionName]);

  const handleDeleteTemplate = useCallback(
    async (name: string) => {
      try {
        await removeTemplate(regionName, name);
        await loadRegion();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [regionName]
  );

  const templateCount = Object.keys(templates).length;

  return (
    <div className="flex flex-col gap-3 p-3 border rounded-md bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Templates: {regionName}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          &times;
        </button>
      </div>

      {/* Region status */}
      {!region || region.bounds_pct.w === 0 ? (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
          Region bounds not set. Draw the region first to capture templates.
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Region: {region.bounds_abs.w}x{region.bounds_abs.h}px at ({region.bounds_abs.x}, {region.bounds_abs.y})
        </div>
      )}

      {/* Existing templates */}
      {templateCount > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-muted-foreground">
            {templateCount} template{templateCount !== 1 ? "s" : ""}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
            {Object.entries(templates).map(([name, dataUri]) => (
              <div
                key={name}
                className="flex flex-col gap-1 p-2 border rounded bg-muted/50"
              >
                <img
                  src={dataUri}
                  alt={name}
                  className="w-full h-auto max-h-[80px] object-contain bg-black/5 rounded"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{name}</span>
                  <button
                    onClick={() => handleDeleteTemplate(name)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capture form */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Template name (e.g., ready, disabled)"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border rounded bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter") captureTemplate();
            }}
          />
          <Button
            size="sm"
            onClick={captureTemplate}
            disabled={capturing || !region || region.bounds_pct.w === 0}
          >
            {capturing ? "..." : "Capture"}
          </Button>
        </div>

        {error && (
          <div className="text-xs text-destructive">{error}</div>
        )}

        <p className="text-xs text-muted-foreground">
          Position the game so the button shows the desired state (e.g., ready, spinning, disabled),
          then click Capture to save a template.
        </p>
      </div>
    </div>
  );
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
