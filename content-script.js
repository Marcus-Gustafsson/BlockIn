const STORAGE_BLOCKED_PATHS_KEY = "blockedPaths";

let lastCheckedUrl = "";
let redirecting = false;

function normalizeDomain(hostname) {
  return hostname.toLowerCase().startsWith("www.")
    ? hostname.toLowerCase().slice(4)
    : hostname.toLowerCase();
}

function matchesBlockedPath(url, blockedPaths) {
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

async function enforceBlockedPath() {
  if (redirecting || window.location.href === lastCheckedUrl) {
    return;
  }

  lastCheckedUrl = window.location.href;

  try {
    const stored = await chrome.storage.local.get([STORAGE_BLOCKED_PATHS_KEY]);
    const blockedPaths = Array.isArray(stored[STORAGE_BLOCKED_PATHS_KEY])
      ? stored[STORAGE_BLOCKED_PATHS_KEY]
      : [];

    if (matchesBlockedPath(window.location, blockedPaths)) {
      redirecting = true;
      chrome.runtime.sendMessage({ action: "redirectTabToVideo" }, (response) => {
        if (!response || !response.ok) {
          window.location.replace(chrome.runtime.getURL("video.html"));
        }
      });
    }
  } catch (error) {
    console.error("Failed to enforce blocked path", error);
  }
}

function scheduleBlockedPathCheck() {
  window.setTimeout(enforceBlockedPath, 0);
}

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function pushState(...args) {
  const result = originalPushState.apply(this, args);
  scheduleBlockedPathCheck();
  return result;
};

history.replaceState = function replaceState(...args) {
  const result = originalReplaceState.apply(this, args);
  scheduleBlockedPathCheck();
  return result;
};

window.addEventListener("popstate", scheduleBlockedPathCheck);
window.addEventListener("hashchange", scheduleBlockedPathCheck);
window.addEventListener("pageshow", scheduleBlockedPathCheck);
document.addEventListener("visibilitychange", scheduleBlockedPathCheck);

scheduleBlockedPathCheck();
window.setInterval(enforceBlockedPath, 1000);
