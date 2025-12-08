/**
 * Import configuration panel.
 *
 * Imports calibration config from file with validation.
 */

import { useCallback, useState } from "react";

import { setCalibrationConfig, clearCalibration } from "../lib/storage";
import type { CalibrationConfig } from "../types";
import { validateConfig } from "../types";

export function ImportPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setStatus(null);
      setErrors([]);

      try {
        const text = await file.text();
        let config: CalibrationConfig;

        try {
          config = JSON.parse(text) as CalibrationConfig;
        } catch {
          setErrors(["Invalid JSON format"]);
          return;
        }

        // Basic structure validation
        const structureErrors: string[] = [];
        if (!config.version) structureErrors.push("Missing version");
        if (!config.calibration_viewport) structureErrors.push("Missing calibration_viewport");
        if (!config.regions) structureErrors.push("Missing regions");

        if (structureErrors.length > 0) {
          setErrors(structureErrors);
          return;
        }

        // Full validation
        const validationErrors = validateConfig(config);
        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          return;
        }

        // Import
        await setCalibrationConfig(config);
        const regionCount = Object.keys(config.regions).length;
        const configuredCount = Object.values(config.regions).filter(
          (r) => r.bounds_pct.w > 0
        ).length;
        setStatus(`Imported ${configuredCount}/${regionCount} regions`);
      } catch (e) {
        setErrors([e instanceof Error ? e.message : "Import failed"]);
      }

      // Reset file input
      e.target.value = "";
    },
    []
  );

  const handleClear = useCallback(async () => {
    if (!confirm("Clear all calibration data? This cannot be undone.")) {
      return;
    }

    await clearCalibration();
    setStatus("Calibration data cleared");
    setErrors([]);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-medium">Import Configuration</h3>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            Select a calibration config JSON file
          </span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
        </label>
      </div>

      {status && (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          {status}
        </div>
      )}

      {errors.length > 0 && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          <strong>Validation errors:</strong>
          <ul className="list-disc list-inside mt-1">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 5 && (
              <li>...and {errors.length - 5} more errors</li>
            )}
          </ul>
        </div>
      )}

      <div className="border-t pt-3 mt-2">
        <button
          onClick={handleClear}
          className="text-sm text-destructive hover:underline"
        >
          Clear All Data
        </button>
      </div>
    </div>
  );
}
