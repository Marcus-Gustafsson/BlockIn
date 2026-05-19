const STORAGE_TIMED_ACCESS_SITES_KEY = "timedAccessSites";
const STORAGE_BLOCKED_PATHS_KEY = "blockedPaths";

const targetElement = document.getElementById("target");
const messageElement = document.getElementById("message");
const workButton = document.getElementById("work");
const procrastinationButton = document.getElementById("procrastination");

function setMessage(message) {
  messageElement.textContent = message;
}

function normalizeDomain(hostname) {
  return hostname.toLowerCase().startsWith("www.")
    ? hostname.toLowerCase().slice(4)
    : hostname.toLowerCase();
}

function getOriginalUrl() {
  const hashValue = window.location.hash.slice(1);
  if (!hashValue) {
    return null;
  }

  try {
    return new URL(hashValue);
  } catch (error) {
    return null;
  }
}

async function getTimedAccessSite(domain) {
  const stored = await chrome.storage.local.get([STORAGE_TIMED_ACCESS_SITES_KEY]);
  const sites = Array.isArray(stored[STORAGE_TIMED_ACCESS_SITES_KEY])
    ? stored[STORAGE_TIMED_ACCESS_SITES_KEY]
    : [];

  return sites.find((site) => site.domain === domain) || null;
}

async function getBlockedPaths() {
  const stored = await chrome.storage.local.get([STORAGE_BLOCKED_PATHS_KEY]);
  return Array.isArray(stored[STORAGE_BLOCKED_PATHS_KEY])
    ? stored[STORAGE_BLOCKED_PATHS_KEY]
    : [];
}

function isBlockedPathUrl(url, blockedPaths) {
  const domain = normalizeDomain(url.hostname);
  const pathname = url.pathname.toLowerCase();

  return blockedPaths.some((item) => {
    if (!item || !item.pattern || !item.pattern.includes("/")) {
      return false;
    }

    const slashIndex = item.pattern.indexOf("/");
    const patternDomain = item.pattern.slice(0, slashIndex);
    const patternPath = item.pattern.slice(slashIndex);
    const basePath = patternPath.endsWith("/*")
      ? patternPath.slice(0, -2)
      : patternPath;

    return (
      domain === patternDomain &&
      (pathname === basePath || pathname.startsWith(`${basePath}/`))
    );
  });
}

async function startTimedAccess(domain) {
  const response = await chrome.runtime.sendMessage({
    action: "startTimedAccess",
    domain
  });

  if (!response || !response.ok) {
    throw new Error((response && response.error) || "Timed access failed.");
  }

  return response;
}

document.addEventListener("DOMContentLoaded", async () => {
  const originalUrl = getOriginalUrl();
  if (!originalUrl) {
    setMessage("Could not read the original site.");
    workButton.disabled = true;
    return;
  }

  const domain = normalizeDomain(originalUrl.hostname);
  const [timedSite, blockedPaths] = await Promise.all([
    getTimedAccessSite(domain),
    getBlockedPaths()
  ]);
  if (!timedSite) {
    setMessage("This site is not configured for timed access.");
    workButton.disabled = true;
    return;
  }

  targetElement.textContent = originalUrl.href;

  workButton.addEventListener("click", async () => {
    workButton.disabled = true;
    setMessage("Starting work timer...");

    try {
      const response = await startTimedAccess(domain);
      const fallbackUrl = response.workUrl || timedSite.workUrl;
      window.location.href = isBlockedPathUrl(originalUrl, blockedPaths)
        ? fallbackUrl
        : originalUrl.href;
    } catch (error) {
      console.error("Failed to start timed access", error);
      setMessage("Could not start timed access. Reload the extension and try again.");
      workButton.disabled = false;
    }
  });

  procrastinationButton.addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("video.html");
  });
});
