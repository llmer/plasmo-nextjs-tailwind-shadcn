/**
 * Export configuration panel.
 *
 * Exports calibration config to clipboard or file.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getCalibrationConfig, getStorageSize } from "../lib/storage";

export function ExportPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportToClipboard() {
    setStatus(null);
    setError(null);

    try {
      const config = await getCalibrationConfig();
      if (!config) {
        setError("No calibration data to export");
        return;
      }

      // Add timestamp
      config.calibration_timestamp = new Date().toISOString();

      const json = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(json);

      const size = new Blob([json]).size;
      setStatus(`Copied to clipboard (${(size / 1024).toFixed(1)} KB)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copy failed");
    }
  }

  async function exportToFile() {
    setStatus(null);
    setError(null);

    try {
      const config = await getCalibrationConfig();
      if (!config) {
        setError("No calibration data to export");
        return;
      }

      config.calibration_timestamp = new Date().toISOString();
      const json = JSON.stringify(config, null, 2);

      // Use File System Access API if available
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
            suggestedName: "calibration-config.json",
            types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(json);
          await writable.close();
          setStatus("Saved to file");
          return;
        } catch (e) {
          // User cancelled or API failed, fall through to download
          if (e instanceof Error && e.name === "AbortError") {
            return;
          }
        }
      }

      // Fallback to download
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "calibration-config.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("Downloaded file");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-medium">Export Configuration</h3>

      <div className="flex gap-2">
        <Button variant="outline" onClick={exportToClipboard}>
          Copy to Clipboard
        </Button>
        <Button variant="outline" onClick={exportToFile}>
          Save to File
        </Button>
      </div>

      {status && (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          {status}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
