/**
 * Calibration overlay content script.
 *
 * Injects an overlay on the page for visualizing and adjusting calibration regions.
 * Supports three modes:
 * - hidden: No visible elements
 * - preview: Shows region boxes with labels (non-interactive)
 * - calibrate: Interactive mode for adjusting region bounds
 */

import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BoundsAbs, CalibrationConfig, RegionConfig } from "../types";
import { toAbsolute, toPercentage } from "../types";
import { getCalibrationConfig, setRegion } from "../lib/storage";

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
};

// Inject styles
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style");
  style.textContent = `
    .calibration-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .region-box {
      position: absolute;
      box-sizing: border-box;
    }
    .region-label {
      position: absolute;
      top: -20px;
      left: 0;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 500;
      color: white;
      white-space: nowrap;
      border-radius: 2px;
    }
    .drag-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: white;
      border: 2px solid #333;
      border-radius: 2px;
    }
    .drag-handle.nw { top: -5px; left: -5px; cursor: nwse-resize; }
    .drag-handle.n { top: -5px; left: calc(50% - 5px); cursor: ns-resize; }
    .drag-handle.ne { top: -5px; right: -5px; cursor: nesw-resize; }
    .drag-handle.e { top: calc(50% - 5px); right: -5px; cursor: ew-resize; }
    .drag-handle.se { bottom: -5px; right: -5px; cursor: nwse-resize; }
    .drag-handle.s { bottom: -5px; left: calc(50% - 5px); cursor: ns-resize; }
    .drag-handle.sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .drag-handle.w { top: calc(50% - 5px); left: -5px; cursor: ew-resize; }
    .draw-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      cursor: crosshair;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.3);
    }
    .draw-overlay::before {
      content: 'Click and drag to draw region boundary';
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: #e91e63;
      color: white;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
    }
    .draw-box {
      position: absolute;
      border: 3px solid #e91e63;
      background: rgba(233, 30, 99, 0.2);
    }
  `;
  return style;
};

type OverlayMode = "hidden" | "preview" | "calibrate";

interface RegionOverlay {
  name: string;
  bounds: BoundsAbs;
  type: "template" | "ocr";
  color: string;
}

const REGION_COLORS: Record<string, string> = {
  balance: "#2196f3",
  bet_amount: "#4caf50",
  win_amount: "#ff9800",
  spin_button: "#e91e63",
  gamble_button: "#9c27b0",
  collect_button: "#673ab7",
  red_card: "#f44336",
  black_card: "#607d8b",
  bonus_indicator: "#ffeb3b",
  autoplay_toggle: "#00bcd4",
  menu_button: "#795548",
};

function getRegionColor(name: string): string {
  return REGION_COLORS[name] || "#888888";
}

function CalibrationOverlay() {
  const [mode, setMode] = useState<OverlayMode>("hidden");
  const [regions, setRegions] = useState<RegionOverlay[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [drawingRegion, setDrawingRegion] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [configRef, setConfigRef] = useState<CalibrationConfig | null>(null);

  // Load regions from storage
  const loadRegions = useCallback(async () => {
    const config = await getCalibrationConfig();
    setConfigRef(config);
    if (!config) {
      setRegions([]);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const overlays: RegionOverlay[] = Object.entries(config.regions)
      .filter(([, region]) => region.bounds_pct.w > 0) // Only show configured regions
      .map(([name, region]) => ({
        name,
        bounds: toAbsolute(region.bounds_pct, { width: vw, height: vh }),
        type: region.type,
        color: getRegionColor(name),
      }));

    setRegions(overlays);
  }, []);

  useEffect(() => {
    loadRegions();
    const handleChange = () => loadRegions();
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, [loadRegions]);

  // Handle messages from popup
  useEffect(() => {
    const handleMessage = (
      message: { type: string; mode?: OverlayMode; regionName?: string },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      console.log("[CalibrationOverlay] Received message:", message);
      switch (message.type) {
        case "SET_OVERLAY_MODE":
          if (message.mode) {
            setMode(message.mode);
            if (message.mode === "hidden") {
              setSelectedRegion(null);
              setDrawingRegion(null);
            }
          }
          sendResponse({ success: true });
          break;
        case "SELECT_REGION":
          if (message.regionName) {
            setSelectedRegion(message.regionName);
            setMode("calibrate");
          }
          sendResponse({ success: true });
          break;
        case "START_DRAW":
          if (message.regionName) {
            console.log("[CalibrationOverlay] Starting draw mode for:", message.regionName);
            setDrawingRegion(message.regionName);
            setSelectedRegion(message.regionName);
            setMode("calibrate");
          }
          sendResponse({ success: true });
          break;
        case "PING":
          // Health check from popup
          sendResponse({ success: true, status: "content_script_active" });
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    console.log("[CalibrationOverlay] Content script loaded and listening");
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRegion(null);
        setDrawingRegion(null);
        setDrawStart(null);
        setDrawCurrent(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle drawing new region bounds
  const handleDrawMouseDown = useCallback((e: React.MouseEvent) => {
    if (!drawingRegion) return;
    setDrawStart({ x: e.clientX, y: e.clientY });
    setDrawCurrent({ x: e.clientX, y: e.clientY });
  }, [drawingRegion]);

  const handleDrawMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawStart) return;
    setDrawCurrent({ x: e.clientX, y: e.clientY });
  }, [drawStart]);

  const handleDrawMouseUp = useCallback(async () => {
    if (!drawingRegion || !drawStart || !drawCurrent) return;

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size check
    if (w < 10 || h < 10) {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const bounds_abs: BoundsAbs = { x, y, w, h };
    const bounds_pct = toPercentage(bounds_abs, viewport);

    // Get existing region config or create new
    const existingRegion = configRef?.regions[drawingRegion];
    const isOCR = ["balance", "bet_amount", "win_amount"].includes(drawingRegion);

    const regionConfig: RegionConfig = {
      bounds_pct,
      bounds_abs,
      type: existingRegion?.type || (isOCR ? "ocr" : "template"),
      ...(existingRegion?.templates && { templates: existingRegion.templates }),
      ...(existingRegion?.ocr_config && { ocr_config: existingRegion.ocr_config }),
      ...(isOCR && !existingRegion?.ocr_config && {
        ocr_config: { preprocessing: "threshold", psm: 7, whitelist: "0123456789.," },
      }),
    };

    await setRegion(drawingRegion, regionConfig);

    setDrawStart(null);
    setDrawCurrent(null);
    setDrawingRegion(null);
  }, [drawingRegion, drawStart, drawCurrent, configRef]);

  // Handle region bounds update via drag
  const handleBoundsChange = useCallback(
    async (regionName: string, newBounds: BoundsAbs) => {
      if (!configRef) return;

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const bounds_pct = toPercentage(newBounds, viewport);

      const existingRegion = configRef.regions[regionName];
      if (!existingRegion) return;

      const regionConfig: RegionConfig = {
        ...existingRegion,
        bounds_pct,
        bounds_abs: newBounds,
      };

      await setRegion(regionName, regionConfig);
    },
    [configRef]
  );

  if (mode === "hidden" && !drawingRegion) return null;

  return (
    <>
      {/* Drawing overlay */}
      {drawingRegion && (
        <div
          className="draw-overlay"
          onMouseDown={handleDrawMouseDown}
          onMouseMove={handleDrawMouseMove}
          onMouseUp={handleDrawMouseUp}
          onMouseLeave={handleDrawMouseUp}
        >
          {drawStart && drawCurrent && (
            <div
              className="draw-box"
              style={{
                left: Math.min(drawStart.x, drawCurrent.x),
                top: Math.min(drawStart.y, drawCurrent.y),
                width: Math.abs(drawCurrent.x - drawStart.x),
                height: Math.abs(drawCurrent.y - drawStart.y),
              }}
            />
          )}
        </div>
      )}

      {/* Region overlay */}
      {!drawingRegion && (
        <div
          className="calibration-overlay"
          style={{ pointerEvents: mode === "calibrate" ? "auto" : "none" }}
        >
          {regions.map((region) => (
            <RegionBox
              key={region.name}
              region={region}
              selected={selectedRegion === region.name}
              editable={mode === "calibrate"}
              onSelect={() => setSelectedRegion(region.name)}
              onBoundsChange={(bounds) => handleBoundsChange(region.name, bounds)}
            />
          ))}
        </div>
      )}
    </>
  );
}

interface RegionBoxProps {
  region: RegionOverlay;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onBoundsChange: (bounds: BoundsAbs) => void;
}

function RegionBox({
  region,
  selected,
  editable,
  onSelect,
  onBoundsChange,
}: RegionBoxProps) {
  const { name, bounds, color } = region;
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; bounds: BoundsAbs } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, type: string) => {
      if (!editable) return;
      e.stopPropagation();
      setIsDragging(true);
      setDragType(type);
      setDragStart({ x: e.clientX, y: e.clientY, bounds: { ...bounds } });
    },
    [editable, bounds]
  );

  useEffect(() => {
    if (!isDragging || !dragStart || !dragType) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      let { x, y, w, h } = dragStart.bounds;

      switch (dragType) {
        case "move":
          x += dx;
          y += dy;
          break;
        case "nw":
          x += dx;
          y += dy;
          w -= dx;
          h -= dy;
          break;
        case "n":
          y += dy;
          h -= dy;
          break;
        case "ne":
          y += dy;
          w += dx;
          h -= dy;
          break;
        case "e":
          w += dx;
          break;
        case "se":
          w += dx;
          h += dy;
          break;
        case "s":
          h += dy;
          break;
        case "sw":
          x += dx;
          w -= dx;
          h += dy;
          break;
        case "w":
          x += dx;
          w -= dx;
          break;
      }

      // Ensure minimum size
      if (w < 10) w = 10;
      if (h < 10) h = 10;

      // Update box position visually
      if (boxRef.current) {
        boxRef.current.style.left = `${x}px`;
        boxRef.current.style.top = `${y}px`;
        boxRef.current.style.width = `${w}px`;
        boxRef.current.style.height = `${h}px`;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      let { x, y, w, h } = dragStart.bounds;

      switch (dragType) {
        case "move":
          x += dx;
          y += dy;
          break;
        case "nw":
          x += dx;
          y += dy;
          w -= dx;
          h -= dy;
          break;
        case "n":
          y += dy;
          h -= dy;
          break;
        case "ne":
          y += dy;
          w += dx;
          h -= dy;
          break;
        case "e":
          w += dx;
          break;
        case "se":
          w += dx;
          h += dy;
          break;
        case "s":
          h += dy;
          break;
        case "sw":
          x += dx;
          w -= dx;
          h += dy;
          break;
        case "w":
          x += dx;
          w -= dx;
          break;
      }

      if (w < 10) w = 10;
      if (h < 10) h = 10;

      onBoundsChange({ x, y, w, h });
      setIsDragging(false);
      setDragType(null);
      setDragStart(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, dragType, onBoundsChange]);

  return (
    <div
      ref={boxRef}
      className="region-box"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.w,
        height: bounds.h,
        border: `2px ${selected ? "solid" : "dashed"} ${color}`,
        backgroundColor: `${color}20`,
        cursor: editable ? "move" : "default",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        // Notify popup that a region was clicked
        console.log("[CalibrationOverlay] Sending REGION_CLICKED for:", name);
        chrome.runtime.sendMessage({
          type: "REGION_CLICKED",
          regionName: name,
        });
      }}
      onMouseDown={(e) => handleMouseDown(e, "move")}
    >
      <span className="region-label" style={{ backgroundColor: color }}>
        {name}
      </span>

      {selected && editable && (
        <>
          <div className="drag-handle nw" onMouseDown={(e) => handleMouseDown(e, "nw")} />
          <div className="drag-handle n" onMouseDown={(e) => handleMouseDown(e, "n")} />
          <div className="drag-handle ne" onMouseDown={(e) => handleMouseDown(e, "ne")} />
          <div className="drag-handle e" onMouseDown={(e) => handleMouseDown(e, "e")} />
          <div className="drag-handle se" onMouseDown={(e) => handleMouseDown(e, "se")} />
          <div className="drag-handle s" onMouseDown={(e) => handleMouseDown(e, "s")} />
          <div className="drag-handle sw" onMouseDown={(e) => handleMouseDown(e, "sw")} />
          <div className="drag-handle w" onMouseDown={(e) => handleMouseDown(e, "w")} />
        </>
      )}
    </div>
  );
}

export default CalibrationOverlay;
