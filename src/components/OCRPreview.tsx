/**
 * OCR preview component.
 *
 * Shows live OCR preview for OCR-type regions with config adjustments.
 */

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BoundsAbs, OCRConfig, RegionConfig } from "../types";
import { getRegion, setRegion } from "../lib/storage";
import { runOCR, checkHealth } from "../lib/api";

interface OCRPreviewProps {
  regionName: string;
  onClose: () => void;
}

export function OCRPreview({ regionName, onClose }: OCRPreviewProps) {
  const [region, setRegionState] = useState<RegionConfig | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; confidence: number; parsed: number | null } | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OCRConfig>({
    preprocessing: "threshold",
    psm: 7,
    whitelist: "0123456789.,",
  });

  // Check server and load region on mount
  useEffect(() => {
    checkHealth().then(setServerOnline);
    loadRegion();
  }, [regionName]);

  async function loadRegion() {
    const r = await getRegion(regionName);
    setRegionState(r);
    if (r?.ocr_config) {
      setConfig(r.ocr_config);
    }
  }

  const handleConfigChange = useCallback(
    async (newConfig: Partial<OCRConfig>) => {
      const updated = { ...config, ...newConfig };
      setConfig(updated);

      // Save to storage
      if (region) {
        const updatedRegion = { ...region, ocr_config: updated };
        await setRegion(regionName, updatedRegion);
        setRegionState(updatedRegion);
      }
    },
    [config, region, regionName]
  );

  const captureAndPreview = useCallback(async () => {
    if (!region || region.bounds_pct.w === 0) {
      setError("Region bounds not set");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Capture screenshot
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });

      if (response.error) {
        throw new Error(response.error);
      }

      const screenshot = response.screenshot;
      if (!screenshot) {
        throw new Error("No screenshot received");
      }

      // Crop to region
      const cropped = await cropImage(
        screenshot,
        region.bounds_abs.x,
        region.bounds_abs.y,
        region.bounds_abs.w,
        region.bounds_abs.h
      );
      setPreview(cropped);

      // Run OCR
      const ocrResult = await runOCR(cropped, config);
      setResult({
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        parsed: ocrResult.parsed_value,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed");
    } finally {
      setLoading(false);
    }
  }, [region, config]);

  const refreshServerStatus = useCallback(async () => {
    const online = await checkHealth();
    setServerOnline(online);
  }, []);

  return (
    <div className="flex flex-col gap-3 p-3 border rounded-md bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">OCR Preview: {regionName}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          &times;
        </button>
      </div>

      {/* Server status */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${serverOnline ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className="text-muted-foreground">
          Server: {serverOnline ? "Online" : "Offline"}
        </span>
        <button
          onClick={refreshServerStatus}
          className="text-xs text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {!serverOnline && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          Preview server not running. Start with:
          <code className="block mt-1 bg-amber-100 p-1 rounded">
            uv run python -m tools.preview_server
          </code>
        </div>
      )}

      {/* Region status */}
      {!region || region.bounds_pct.w === 0 ? (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
          Region bounds not set. Draw the region first.
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Region: {region.bounds_abs.w}x{region.bounds_abs.h}px
        </div>
      )}

      {/* Preview image */}
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Preview</div>
        <div className="border rounded bg-muted/50 p-2 min-h-[60px] flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="Region preview" className="max-w-full max-h-[80px] object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">Click Capture to preview</span>
          )}
        </div>
      </div>

      {/* OCR result */}
      {result && (
        <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Text:</span>
            <span className="font-mono">{result.text || "(empty)"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Parsed:</span>
            <span className="font-mono">{result.parsed !== null ? result.parsed : "N/A"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Confidence:</span>
            <span className={result.confidence > 80 ? "text-green-600" : "text-amber-600"}>
              {result.confidence.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {error && <div className="text-xs text-destructive">{error}</div>}

      {/* OCR config */}
      <div className="flex flex-col gap-2 border-t pt-2">
        <div className="text-sm text-muted-foreground">OCR Settings</div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs">
            Preprocessing
            <select
              value={config.preprocessing}
              onChange={(e) => handleConfigChange({ preprocessing: e.target.value as OCRConfig["preprocessing"] })}
              className="text-sm p-1 border rounded bg-background"
            >
              <option value="threshold">Threshold</option>
              <option value="adaptive">Adaptive</option>
              <option value="none">None</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            PSM
            <select
              value={config.psm}
              onChange={(e) => handleConfigChange({ psm: parseInt(e.target.value) })}
              className="text-sm p-1 border rounded bg-background"
            >
              <option value="6">6 - Block of text</option>
              <option value="7">7 - Single line</option>
              <option value="8">8 - Single word</option>
              <option value="13">13 - Raw line</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          Whitelist
          <input
            type="text"
            value={config.whitelist}
            onChange={(e) => handleConfigChange({ whitelist: e.target.value })}
            className="text-sm p-1 border rounded bg-background font-mono"
            placeholder="0123456789.,"
          />
        </label>
      </div>

      {/* Actions */}
      <Button
        onClick={captureAndPreview}
        disabled={loading || !serverOnline || !region || region.bounds_pct.w === 0}
      >
        {loading ? "Processing..." : "Capture & Preview"}
      </Button>
    </div>
  );
}

/**
 * Crop an image to specified bounds.
 */
async function cropImage(
  dataUri: string,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUri;
  });
}
