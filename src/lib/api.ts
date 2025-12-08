/**
 * API client for the preview server.
 *
 * Communicates with the Python preview server for OCR and template matching.
 */

const PREVIEW_SERVER = "http://localhost:8765";

export interface OCRResponse {
  text: string;
  confidence: number;
  parsed_value: number | null;
}

export interface TemplateMatchResponse {
  match: boolean;
  score: number;
  location?: { x: number; y: number };
}

export interface HealthResponse {
  status: string;
  version: string;
}

/**
 * Check if the preview server is running.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PREVIEW_SERVER}/health`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get server health info.
 */
export async function getHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${PREVIEW_SERVER}/health`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Run OCR on an image.
 *
 * @param image - Base64 data URI of the image
 * @param config - Optional OCR configuration
 */
export async function runOCR(
  image: string,
  config?: { preprocessing?: string; psm?: number; whitelist?: string }
): Promise<OCRResponse> {
  const response = await fetch(`${PREVIEW_SERVER}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, config }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OCR failed: ${error}`);
  }

  return response.json();
}

/**
 * Match a template against an image.
 *
 * @param image - Base64 data URI of the image to search
 * @param template - Base64 data URI of the template
 */
export async function matchTemplate(
  image: string,
  template: string
): Promise<TemplateMatchResponse> {
  const response = await fetch(`${PREVIEW_SERVER}/template-match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, template }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Template match failed: ${error}`);
  }

  return response.json();
}

/**
 * Run OCR with retries.
 */
export async function runOCRWithRetry(
  image: string,
  config?: { preprocessing?: string; psm?: number; whitelist?: string },
  maxRetries = 2
): Promise<OCRResponse> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await runOCR(image, config);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("Unknown error");
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError || new Error("OCR failed after retries");
}
