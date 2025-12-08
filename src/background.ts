/**
 * Background service worker for the calibration extension.
 *
 * Handles:
 * - Screenshot capture via chrome.tabs.captureVisibleTab
 * - Message routing between popup and content scripts
 */

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Calibration extension installed");
});

// Message types
interface CaptureScreenshotMessage {
  type: "CAPTURE_SCREENSHOT";
}

interface CaptureScreenshotResponse {
  screenshot: string;
  error?: string;
}

interface GetTabInfoMessage {
  type: "GET_TAB_INFO";
}

interface GetTabInfoResponse {
  tabId: number;
  url: string;
  width: number;
  height: number;
}

type ExtensionMessage = CaptureScreenshotMessage | GetTabInfoMessage;

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === "CAPTURE_SCREENSHOT") {
      captureScreenshot()
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            screenshot: "",
            error: error instanceof Error ? error.message : "Unknown error",
          })
        );
      return true; // Keep channel open for async response
    }

    if (message.type === "GET_TAB_INFO") {
      getTabInfo()
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            tabId: -1,
            url: "",
            width: 0,
            height: 0,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        );
      return true;
    }
  }
);

/**
 * Capture a screenshot of the current active tab.
 */
async function captureScreenshot(): Promise<CaptureScreenshotResponse> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png",
    });
    return { screenshot: dataUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed";
    console.error("Screenshot capture failed:", message);
    return { screenshot: "", error: message };
  }
}

/**
 * Get information about the current active tab.
 */
async function getTabInfo(): Promise<GetTabInfoResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("No active tab found");
  }

  return {
    tabId: tab.id,
    url: tab.url || "",
    width: tab.width || 0,
    height: tab.height || 0,
  };
}

export {};
