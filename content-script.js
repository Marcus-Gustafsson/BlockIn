const STORAGE_BLOCKED_PATHS_KEY = "blockedPaths";
const STORAGE_TIMED_ACCESS_SITES_KEY = "timedAccessSites";
const STORAGE_TIMED_ACCESS_SESSIONS_KEY = "timedAccessSessions";

let lastCheckedUrl = "";
let redirecting = false;
let timedAccessTimerId = null;
let timedAccessModal = null;
let lastTimedAccessUrl = "";
let lastTimedAccessKey = "";
let mediaPauseTimerId = null;
let savedDocumentOverflow = null;
let savedBodyOverflow = null;
let checkInVideoMessageListenerInstalled = false;

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

function getTimedAccessKey(site) {
  return site.pattern || site.domain;
}

function getPatternBasePath(pattern) {
  const slashIndex = pattern.indexOf("/");
  const patternPath = pattern.slice(slashIndex);

  return patternPath.endsWith("/*")
    ? patternPath.slice(0, -2)
    : patternPath;
}

function matchesTimedAccessPattern(url, site) {
  if (!site || !site.pattern || !site.pattern.includes("/")) {
    return false;
  }

  const slashIndex = site.pattern.indexOf("/");
  const patternDomain = site.pattern.slice(0, slashIndex);
  const basePath = getPatternBasePath(site.pattern);
  const domain = normalizeDomain(url.hostname);
  const pathname = url.pathname.toLowerCase();

  return (
    domain === patternDomain &&
    (pathname === basePath || pathname.startsWith(`${basePath}/`))
  );
}

function findTimedAccessSite(url, sites) {
  const domain = normalizeDomain(url.hostname);
  const pathSite = sites
    .filter((site) => matchesTimedAccessPattern(url, site))
    .sort((first, second) => getPatternBasePath(second.pattern).length - getPatternBasePath(first.pattern).length)[0];

  return (
    pathSite ||
    sites.find((site) => site && !site.pattern && site.domain === domain) ||
    null
  );
}

function findActiveTimedAccessSession(accessKey, sessions) {
  const now = Date.now();
  return (
    sessions.find(
      (session) =>
        session &&
        session.domain === accessKey &&
        Number.isInteger(session.expiresAt) &&
        session.expiresAt > now
    ) || null
  );
}

function clearTimedAccessTimer() {
  if (timedAccessTimerId !== null) {
    window.clearTimeout(timedAccessTimerId);
    timedAccessTimerId = null;
  }
}

function scheduleTimedAccessExpiryCheck(expiresAt) {
  clearTimedAccessTimer();
  timedAccessTimerId = window.setTimeout(
    enforceTimedAccess,
    Math.max(expiresAt - Date.now(), 0) + 250
  );
}

function lockPageScroll() {
  if (savedDocumentOverflow === null) {
    savedDocumentOverflow = document.documentElement.style.overflow;
    savedBodyOverflow = document.body ? document.body.style.overflow : "";
  }

  document.documentElement.style.overflow = "hidden";
  if (document.body) {
    document.body.style.overflow = "hidden";
  }
}

function unlockPageScroll() {
  if (savedDocumentOverflow === null) {
    return;
  }

  document.documentElement.style.overflow = savedDocumentOverflow;
  if (document.body) {
    document.body.style.overflow = savedBodyOverflow || "";
  }
  savedDocumentOverflow = null;
  savedBodyOverflow = null;
}

function pausePageMedia() {
  document.querySelectorAll("video, audio").forEach((mediaElement) => {
    if (!mediaElement.paused) {
      mediaElement.pause();
    }
  });
}

function startMediaPauseGuard() {
  pausePageMedia();
  if (mediaPauseTimerId === null) {
    mediaPauseTimerId = window.setInterval(pausePageMedia, 250);
  }
}

function stopMediaPauseGuard() {
  if (mediaPauseTimerId !== null) {
    window.clearInterval(mediaPauseTimerId);
    mediaPauseTimerId = null;
  }
}

function removeTimedAccessModal() {
  if (timedAccessModal) {
    timedAccessModal.remove();
    timedAccessModal = null;
  }
  stopMediaPauseGuard();
  unlockPageScroll();
}

function setTimedAccessModalMessage(modal, message) {
  const messageElement = modal.querySelector("[data-blockin-message]");
  if (messageElement) {
    messageElement.textContent = message;
  }
}

function redirectToMotivationVideo() {
  redirecting = true;
  chrome.runtime.sendMessage({ action: "redirectTabToVideo" }, (response) => {
    if (!response || !response.ok) {
      window.location.replace(chrome.runtime.getURL("video.html"));
    }
  });
}

function styleActionButton(button, options = {}) {
  button.style.alignItems = "center";
  button.style.appearance = "none";
  button.style.background = options.primary
    ? "#f6f7fb"
    : "rgba(255, 255, 255, 0.08)";
  button.style.border = options.primary
    ? "0"
    : "1px solid rgba(255, 255, 255, 0.14)";
  button.style.borderRadius = "999px";
  button.style.boxSizing = "border-box";
  button.style.color = options.primary ? "#0f1218" : "#eef1f6";
  button.style.cursor = "pointer";
  button.style.display = "inline-flex";
  button.style.fontSize = "16px";
  button.style.fontWeight = "700";
  button.style.justifyContent = "center";
  button.style.lineHeight = "1";
  button.style.margin = "0";
  button.style.minHeight = "44px";
  button.style.minWidth = options.minWidth || "132px";
  button.style.overflow = "visible";
  button.style.padding = "13px 18px";
  button.style.textAlign = "center";
  button.style.transition = "transform 140ms ease, background 140ms ease";
  button.style.whiteSpace = "nowrap";

  button.addEventListener("mouseenter", () => {
    button.style.transform = "translateY(-1px)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.transform = "translateY(0)";
  });
}

function installCheckInVideoMessageListener() {
  if (checkInVideoMessageListenerInstalled) {
    return;
  }

  window.addEventListener("message", (event) => {
    const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;
    if (
      event.origin !== extensionOrigin ||
      !event.data ||
      event.data.source !== "blockin-check-in-video" ||
      !timedAccessModal
    ) {
      return;
    }

    const frameWrapper = timedAccessModal.querySelector("[data-blockin-check-in-video]");
    if (frameWrapper) {
      frameWrapper.style.display = event.data.hasVideo ? "block" : "none";
    }

    const panel = timedAccessModal.querySelector("[data-blockin-panel]");
    if (panel) {
      panel.style.maxWidth = event.data.hasVideo ? "760px" : "520px";
    }
  });

  checkInVideoMessageListenerInstalled = true;
}

function createCheckInVideoFrame() {
  installCheckInVideoMessageListener();

  const frameWrapper = document.createElement("div");
  frameWrapper.dataset.blockinCheckInVideo = "true";
  frameWrapper.style.background = "rgba(0, 0, 0, 0.34)";
  frameWrapper.style.border = "1px solid rgba(255, 255, 255, 0.12)";
  frameWrapper.style.borderRadius = "14px";
  frameWrapper.style.display = "none";
  frameWrapper.style.margin = "0 auto 22px";
  frameWrapper.style.maxWidth = "640px";
  frameWrapper.style.overflow = "hidden";

  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("check-in-video.html");
  frame.title = "Work check-in video";
  frame.allow = "autoplay";
  frame.style.aspectRatio = "16 / 9";
  frame.style.border = "0";
  frame.style.display = "block";
  frame.style.width = "100%";

  frameWrapper.append(frame);
  return frameWrapper;
}

async function startTimedAccessFromModal(overlay, site, buttons) {
  buttons.forEach((button) => {
    button.disabled = true;
  });
  setTimedAccessModalMessage(overlay, "Starting work timer...");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "startTimedAccess",
      domain: getTimedAccessKey(site)
    });
    if (!response || !response.ok) {
      throw new Error((response && response.error) || "Timed access failed.");
    }

    removeTimedAccessModal();
    scheduleTimedAccessExpiryCheck(response.expiresAt);
  } catch (error) {
    console.error("Failed to start timed access", error);
    setTimedAccessModalMessage(overlay, "Could not start timer. Reload extension and try again.");
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function renderWorkConfirmModal(overlay, panel, site) {
  panel.textContent = "";
  panel.style.maxWidth = "520px";

  const title = document.createElement("h1");
  title.textContent = "Are you doing the work?";
  title.style.color = "#fff";
  title.style.fontSize = "34px";
  title.style.fontWeight = "700";
  title.style.lineHeight = "1.2";
  title.style.margin = "0 0 12px";

  const body = document.createElement("p");
  body.textContent =
    "Pause before you unlock this. If this page helps the real task, commit to it. If this is avoidance, choose the honest exit.";
  body.style.color = "#c9ced8";
  body.style.fontSize = "16px";
  body.style.lineHeight = "1.45";
  body.style.margin = "0 auto 18px";
  body.style.maxWidth = "560px";

  const target = document.createElement("p");
  target.textContent = getTimedAccessKey(site);
  target.style.background = "rgba(255, 255, 255, 0.08)";
  target.style.border = "1px solid rgba(255, 255, 255, 0.08)";
  target.style.borderRadius = "999px";
  target.style.color = "#aab2c0";
  target.style.display = "inline-block";
  target.style.fontSize = "13px";
  target.style.margin = "0 0 22px";
  target.style.overflowWrap = "anywhere";
  target.style.padding = "7px 11px";

  const videoFrame = createCheckInVideoFrame();

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.flexWrap = "wrap";
  actions.style.gap = "12px";
  actions.style.justifyContent = "center";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.textContent = "Yes, work";
  styleActionButton(confirmButton, { primary: true, minWidth: "146px" });

  const procrastinationButton = document.createElement("button");
  procrastinationButton.type = "button";
  procrastinationButton.textContent = "No, procrastination";
  styleActionButton(procrastinationButton, { minWidth: "190px" });

  const message = document.createElement("p");
  message.dataset.blockinMessage = "true";
  message.setAttribute("role", "status");
  message.style.color = "#f6cf82";
  message.style.fontSize = "14px";
  message.style.margin = "14px 0 0";
  message.style.minHeight = "20px";

  confirmButton.addEventListener("click", () => {
    startTimedAccessFromModal(overlay, site, [
      confirmButton,
      procrastinationButton
    ]);
  });
  procrastinationButton.addEventListener("click", redirectToMotivationVideo);

  actions.append(confirmButton, procrastinationButton);
  panel.append(title, body, target, videoFrame, actions, message);
}

function createTimedAccessModal(site) {
  if (timedAccessModal) {
    return timedAccessModal;
  }

  const overlay = document.createElement("div");
  overlay.id = "blockin-timed-access-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.background = "rgba(0, 0, 0, 0.78)";
  overlay.style.backdropFilter = "blur(14px) saturate(0.65)";
  overlay.style.boxSizing = "border-box";
  overlay.style.color = "#f6f7fb";
  overlay.style.display = "flex";
  overlay.style.fontFamily = "Arial, sans-serif";
  overlay.style.inset = "0";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.padding = "24px";
  overlay.style.position = "fixed";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 160ms ease";
  overlay.style.zIndex = "2147483647";

  const panel = document.createElement("section");
  panel.dataset.blockinPanel = "true";
  panel.style.background = "linear-gradient(180deg, #171b22 0%, #0f1218 100%)";
  panel.style.border = "1px solid rgba(255, 255, 255, 0.16)";
  panel.style.borderRadius = "18px";
  panel.style.boxShadow = "0 28px 90px rgba(0, 0, 0, 0.58)";
  panel.style.boxSizing = "border-box";
  panel.style.maxWidth = "520px";
  panel.style.padding = "30px";
  panel.style.textAlign = "center";
  panel.style.transform = "translateY(8px) scale(0.98)";
  panel.style.transition = "transform 180ms ease";
  panel.style.width = "100%";

  const title = document.createElement("h1");
  title.textContent = "Working?";
  title.style.color = "#fff";
  title.style.fontSize = "34px";
  title.style.fontWeight = "700";
  title.style.lineHeight = "1.2";
  title.style.margin = "0 0 12px";

  const body = document.createElement("p");
  body.textContent =
    "Stay with the task, or call it what it is and switch to a motivation video.";
  body.style.color = "#c9ced8";
  body.style.fontSize = "16px";
  body.style.lineHeight = "1.45";
  body.style.margin = "0 auto 18px";
  body.style.maxWidth = "380px";

  const target = document.createElement("p");
  target.textContent = getTimedAccessKey(site);
  target.style.background = "rgba(255, 255, 255, 0.08)";
  target.style.border = "1px solid rgba(255, 255, 255, 0.08)";
  target.style.borderRadius = "999px";
  target.style.color = "#aab2c0";
  target.style.display = "inline-block";
  target.style.fontSize = "13px";
  target.style.margin = "0 0 22px";
  target.style.overflowWrap = "anywhere";
  target.style.padding = "7px 11px";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.flexWrap = "wrap";
  actions.style.gap = "12px";
  actions.style.justifyContent = "center";

  const workButton = document.createElement("button");
  workButton.type = "button";
  workButton.textContent = "Work";
  styleActionButton(workButton, { primary: true });

  const procrastinationButton = document.createElement("button");
  procrastinationButton.type = "button";
  procrastinationButton.textContent = "Procrastination";
  styleActionButton(procrastinationButton, { minWidth: "172px" });

  const message = document.createElement("p");
  message.dataset.blockinMessage = "true";
  message.setAttribute("role", "status");
  message.style.color = "#f6cf82";
  message.style.fontSize = "14px";
  message.style.margin = "14px 0 0";
  message.style.minHeight = "20px";

  workButton.addEventListener("click", () => {
    renderWorkConfirmModal(overlay, panel, site);
  });

  procrastinationButton.addEventListener("click", redirectToMotivationVideo);

  actions.append(workButton, procrastinationButton);
  panel.append(title, body, target, actions, message);
  overlay.append(panel);
  timedAccessModal = overlay;
  window.requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    panel.style.transform = "translateY(0) scale(1)";
  });

  return overlay;
}

async function enforceTimedAccess() {
  if (redirecting) {
    return;
  }

  const currentUrl = window.location.href;

  try {
    const stored = await chrome.storage.local.get([
      STORAGE_TIMED_ACCESS_SITES_KEY,
      STORAGE_TIMED_ACCESS_SESSIONS_KEY
    ]);
    const sites = Array.isArray(stored[STORAGE_TIMED_ACCESS_SITES_KEY])
      ? stored[STORAGE_TIMED_ACCESS_SITES_KEY]
      : [];
    const sessions = Array.isArray(stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY])
      ? stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY]
      : [];
    const site = findTimedAccessSite(window.location, sites);
    const accessKey = site ? getTimedAccessKey(site) : "";
    const previousAccessKey = lastTimedAccessKey;

    lastTimedAccessUrl = currentUrl;
    lastTimedAccessKey = accessKey;

    if (!site) {
      clearTimedAccessTimer();
      removeTimedAccessModal();
      return;
    }

    const activeSession = findActiveTimedAccessSession(accessKey, sessions);
    if (activeSession) {
      removeTimedAccessModal();
      scheduleTimedAccessExpiryCheck(activeSession.expiresAt);
      return;
    }

    clearTimedAccessTimer();
    if (timedAccessModal && previousAccessKey && previousAccessKey !== accessKey) {
      removeTimedAccessModal();
    }
    lockPageScroll();
    startMediaPauseGuard();
    document.documentElement.append(createTimedAccessModal(site));
  } catch (error) {
    console.error("Failed to enforce timed access", error);
  }
}

async function enforceBlockedPath() {
  if (redirecting || window.location.href === lastCheckedUrl) {
    return;
  }

  lastCheckedUrl = window.location.href;

  try {
    const stored = await chrome.storage.local.get([
      STORAGE_BLOCKED_PATHS_KEY,
      STORAGE_TIMED_ACCESS_SITES_KEY
    ]);
    const blockedPaths = Array.isArray(stored[STORAGE_BLOCKED_PATHS_KEY])
      ? stored[STORAGE_BLOCKED_PATHS_KEY]
      : [];
    const timedAccessSites = Array.isArray(stored[STORAGE_TIMED_ACCESS_SITES_KEY])
      ? stored[STORAGE_TIMED_ACCESS_SITES_KEY]
      : [];

    if (timedAccessSites.some((site) => matchesTimedAccessPattern(window.location, site))) {
      return;
    }

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

function scheduleTimedAccessCheck() {
  window.setTimeout(enforceTimedAccess, 0);
}

function checkUrlForTimedAccessChange() {
  if (redirecting || window.location.href === lastTimedAccessUrl) {
    return;
  }

  scheduleTimedAccessCheck();
}

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function pushState(...args) {
  const result = originalPushState.apply(this, args);
  scheduleBlockedPathCheck();
  scheduleTimedAccessCheck();
  return result;
};

history.replaceState = function replaceState(...args) {
  const result = originalReplaceState.apply(this, args);
  scheduleBlockedPathCheck();
  scheduleTimedAccessCheck();
  return result;
};

window.addEventListener("popstate", scheduleBlockedPathCheck);
window.addEventListener("hashchange", scheduleBlockedPathCheck);
window.addEventListener("pageshow", scheduleBlockedPathCheck);
window.addEventListener("popstate", scheduleTimedAccessCheck);
window.addEventListener("hashchange", scheduleTimedAccessCheck);
window.addEventListener("pageshow", scheduleTimedAccessCheck);
document.addEventListener("play", () => {
  if (timedAccessModal) {
    pausePageMedia();
  }
}, true);
document.addEventListener("visibilitychange", () => {
  scheduleBlockedPathCheck();
  scheduleTimedAccessCheck();
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[STORAGE_BLOCKED_PATHS_KEY] || changes[STORAGE_TIMED_ACCESS_SITES_KEY]) {
    lastCheckedUrl = "";
    scheduleBlockedPathCheck();
  }

  if (changes[STORAGE_TIMED_ACCESS_SITES_KEY] || changes[STORAGE_TIMED_ACCESS_SESSIONS_KEY]) {
    scheduleTimedAccessCheck();
  }
});

scheduleBlockedPathCheck();
scheduleTimedAccessCheck();
window.setInterval(enforceBlockedPath, 1000);
window.setInterval(checkUrlForTimedAccessChange, 500);
