const STORAGE_BLOCKED_PATHS_KEY = "blockedPaths";
const STORAGE_TIMED_ACCESS_SITES_KEY = "timedAccessSites";
const STORAGE_TIMED_ACCESS_SESSIONS_KEY = "timedAccessSessions";
const STORAGE_TIMED_ACCESS_MOOD_LOG_KEY = "timedAccessMoodLog";
const STORAGE_LEISURE_SITES_KEY = "leisureSites";

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
let leisureModal = null;
let leisureActive = false;
let leisureHeartbeatId = null;
let leisureExpiryTimerId = null;
let lastLeisureUrl = "";

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

function findAccessSite(url, sites) {
  return findTimedAccessSite(url, sites);
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

function formatLeisureTime(milliseconds) {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function clearLeisureTimers() {
  if (leisureHeartbeatId !== null) {
    window.clearInterval(leisureHeartbeatId);
    leisureHeartbeatId = null;
  }
  if (leisureExpiryTimerId !== null) {
    window.clearTimeout(leisureExpiryTimerId);
    leisureExpiryTimerId = null;
  }
}

function removeLeisureModal() {
  if (leisureModal) {
    leisureModal.remove();
    leisureModal = null;
  }
  stopMediaPauseGuard();
  unlockPageScroll();
}

function pauseLeisure() {
  const wasActive = leisureActive;
  leisureActive = false;
  clearLeisureTimers();
  if (wasActive) {
    chrome.runtime.sendMessage({ action: "pauseLeisure" }, () => {
      void chrome.runtime.lastError;
    });
  }
}

function scheduleLeisureExpiry(status) {
  if (leisureExpiryTimerId !== null) {
    window.clearTimeout(leisureExpiryTimerId);
  }
  const untilPeriodEnd = Number.isFinite(status.periodEndsAt)
    ? status.periodEndsAt - Date.now()
    : status.remainingMs;
  leisureExpiryTimerId = window.setTimeout(
    redirectToMotivationVideo,
    Math.max(Math.min(status.remainingMs, untilPeriodEnd), 0) + 100
  );
}

function handleLeisureHeartbeat() {
  if (!leisureActive || document.hidden || !document.hasFocus()) {
    return;
  }

  chrome.runtime.sendMessage({ action: "heartbeatLeisure" }, (status) => {
    if (!leisureActive) {
      return;
    }
    if (!status || !status.ok) {
      return;
    }
    if (!status.available || status.status === "exhausted" || status.status === "unavailable") {
      leisureActive = false;
      clearLeisureTimers();
      redirectToMotivationVideo();
      return;
    }
    if (!status.ownsLease) {
      leisureActive = false;
      clearLeisureTimers();
      enforceLeisureAccess();
      return;
    }
    scheduleLeisureExpiry(status);
  });
}

function startLeisureHeartbeat(status) {
  leisureActive = true;
  clearLeisureTimers();
  scheduleLeisureExpiry(status);
  leisureHeartbeatId = window.setInterval(handleLeisureHeartbeat, 1000);
}

function createLeisureModal(site, status) {
  if (leisureModal) {
    const remaining = leisureModal.querySelector("[data-blockin-leisure-remaining]");
    if (remaining) {
      remaining.textContent = `${formatLeisureTime(status.remainingMs)} remaining in ${status.periodLabel.toLowerCase()} period`;
    }
    return leisureModal;
  }

  const overlay = document.createElement("div");
  overlay.id = "blockin-leisure-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  Object.assign(overlay.style, {
    alignItems: "center",
    backdropFilter: "blur(14px) saturate(0.7)",
    background: "rgba(5, 12, 18, 0.8)",
    boxSizing: "border-box",
    color: "#f6f7fb",
    display: "flex",
    fontFamily: "Arial, sans-serif",
    inset: "0",
    justifyContent: "center",
    padding: "24px",
    position: "fixed",
    zIndex: "2147483647"
  });

  const panel = document.createElement("section");
  Object.assign(panel.style, {
    background: "linear-gradient(180deg, #17232a 0%, #0d151a 100%)",
    border: "1px solid rgba(255, 255, 255, 0.16)",
    borderRadius: "18px",
    boxShadow: "0 28px 90px rgba(0, 0, 0, 0.58)",
    boxSizing: "border-box",
    maxWidth: "520px",
    padding: "30px",
    textAlign: "center",
    width: "100%"
  });

  const title = document.createElement("h1");
  title.textContent = "Use leisure time now?";
  Object.assign(title.style, { color: "#fff", fontSize: "32px", margin: "0 0 12px" });

  const body = document.createElement("p");
  body.textContent = "This uses the shared leisure budget across all leisure sites. Time pauses when this tab is not visible and focused.";
  Object.assign(body.style, { color: "#c9d5d9", fontSize: "16px", lineHeight: "1.45", margin: "0 0 18px" });

  const target = document.createElement("p");
  target.textContent = getTimedAccessKey(site);
  Object.assign(target.style, { color: "#9fb0b7", fontSize: "13px", margin: "0 0 8px", overflowWrap: "anywhere" });

  const remaining = document.createElement("p");
  remaining.dataset.blockinLeisureRemaining = "true";
  remaining.textContent = `${formatLeisureTime(status.remainingMs)} remaining in ${status.periodLabel.toLowerCase()} period`;
  Object.assign(remaining.style, { color: "#8ee3bd", fontSize: "18px", fontWeight: "700", margin: "0 0 22px" });

  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" });
  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.textContent = "Yes, use leisure time";
  styleActionButton(confirmButton, { primary: true, minWidth: "190px" });
  const exitButton = document.createElement("button");
  exitButton.type = "button";
  exitButton.textContent = "No, motivate me";
  styleActionButton(exitButton, { minWidth: "170px" });

  const message = document.createElement("p");
  message.setAttribute("role", "status");
  Object.assign(message.style, { color: "#f6cf82", fontSize: "14px", margin: "14px 0 0", minHeight: "20px" });

  confirmButton.addEventListener("click", () => {
    confirmButton.disabled = true;
    exitButton.disabled = true;
    message.textContent = "Starting leisure timer...";
    chrome.runtime.sendMessage({
      action: "startLeisure",
      accessKey: getTimedAccessKey(site)
    }, (response) => {
      if (!response || !response.ok) {
        message.textContent = "Could not start leisure timer. Reload extension and try again.";
        confirmButton.disabled = false;
        exitButton.disabled = false;
        return;
      }
      if (!response.available) {
        redirectToMotivationVideo();
        return;
      }
      removeLeisureModal();
      startLeisureHeartbeat(response);
      if (document.hidden || !document.hasFocus()) {
        pauseLeisure();
      }
    });
  });
  exitButton.addEventListener("click", redirectToMotivationVideo);

  actions.append(confirmButton, exitButton);
  panel.append(title, body, target, remaining, actions, message);
  overlay.append(panel);
  leisureModal = overlay;
  return overlay;
}

async function enforceLeisureAccess() {
  if (redirecting) {
    return;
  }

  try {
    const stored = await chrome.storage.local.get([STORAGE_LEISURE_SITES_KEY]);
    const sites = Array.isArray(stored[STORAGE_LEISURE_SITES_KEY])
      ? stored[STORAGE_LEISURE_SITES_KEY]
      : [];
    const site = findAccessSite(window.location, sites);
    const urlChanged = window.location.href !== lastLeisureUrl;
    lastLeisureUrl = window.location.href;

    if (!site) {
      pauseLeisure();
      removeLeisureModal();
      return;
    }

    removeTimedAccessModal();
    if (document.hidden || !document.hasFocus()) {
      pauseLeisure();
      removeLeisureModal();
      return;
    }

    if (leisureActive && !urlChanged) {
      return;
    }

    const status = await chrome.runtime.sendMessage({ action: "getLeisureStatus" });
    if (!status || !status.ok) {
      return;
    }
    if (!status.available) {
      redirectToMotivationVideo();
      return;
    }
    if (leisureActive && status.ownsLease) {
      scheduleLeisureExpiry(status);
      return;
    }

    pauseLeisure();
    lockPageScroll();
    startMediaPauseGuard();
    document.documentElement.append(createLeisureModal(site, status));
  } catch (error) {
    console.error("Failed to enforce leisure access", error);
  }
}

async function recordTimedAccessMood(site, mood) {
  const accessKey = getTimedAccessKey(site);
  const entry = {
    mood: mood.value,
    label: mood.label,
    accessKey,
    url: window.location.href,
    hostname: window.location.hostname,
    createdAt: Date.now()
  };

  try {
    const stored = await chrome.storage.local.get([
      STORAGE_TIMED_ACCESS_MOOD_LOG_KEY
    ]);
    const moodLog = Array.isArray(stored[STORAGE_TIMED_ACCESS_MOOD_LOG_KEY])
      ? stored[STORAGE_TIMED_ACCESS_MOOD_LOG_KEY]
      : [];

    await chrome.storage.local.set({
      [STORAGE_TIMED_ACCESS_MOOD_LOG_KEY]: moodLog.concat(entry)
    });
  } catch (error) {
    console.error("Failed to record timed access mood", error);
  } finally {
    redirectToMotivationVideo();
  }
}

function styleActionButton(button, options = {}) {
  button.style.alignItems = "center";
  button.style.appearance = "none";
  button.style.background = options.background || (
    options.primary
      ? "#f6f7fb"
      : "rgba(255, 255, 255, 0.08)"
  );
  button.style.border = options.primary
    ? "0"
    : "1px solid rgba(255, 255, 255, 0.14)";
  button.style.borderRadius = "999px";
  button.style.boxSizing = "border-box";
  button.style.color = options.color || (options.primary ? "#0f1218" : "#eef1f6");
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

function createMoodButton(mood, site, buttons) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = mood.label;
  styleActionButton(button, {
    background: mood.background,
    color: mood.color,
    minWidth: mood.minWidth
  });

  button.addEventListener("click", () => {
    buttons.forEach((item) => {
      item.disabled = true;
    });
    recordTimedAccessMood(site, mood);
  });

  return button;
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

  const workActions = document.createElement("div");
  workActions.style.display = "flex";
  workActions.style.justifyContent = "center";
  workActions.style.margin = "0 0 22px";

  const workButton = document.createElement("button");
  workButton.type = "button";
  workButton.textContent = "Work";
  styleActionButton(workButton, { primary: true });

  const divider = document.createElement("div");
  divider.setAttribute("aria-hidden", "true");
  divider.style.borderTop = "1px solid rgba(255, 255, 255, 0.16)";
  divider.style.margin = "0 auto 22px";
  divider.style.width = "80%";

  const modalButtons = [workButton];
  const moods = [
    {
      value: "tired",
      label: "Tired?",
      background: "#2563eb",
      color: "#f8fbff",
      minWidth: "118px"
    },
    {
      value: "unmotivated",
      label: "Unmotivated?",
      background: "#d97706",
      color: "#fff8ed",
      minWidth: "158px"
    },
    {
      value: "scared_of_failure",
      label: "Scared of failure?",
      background: "#be123c",
      color: "#fff5f7",
      minWidth: "190px"
    }
  ];

  const moodActions = document.createElement("div");
  moodActions.style.display = "flex";
  moodActions.style.flexWrap = "wrap";
  moodActions.style.gap = "10px";
  moodActions.style.justifyContent = "center";

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

  moods.forEach((mood) => {
    const button = createMoodButton(mood, site, modalButtons);
    modalButtons.push(button);
    moodActions.append(button);
  });

  workActions.append(workButton);
  panel.append(title, body, target, workActions, divider, moodActions, message);
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
      STORAGE_TIMED_ACCESS_SESSIONS_KEY,
      STORAGE_LEISURE_SITES_KEY
    ]);
    const sites = Array.isArray(stored[STORAGE_TIMED_ACCESS_SITES_KEY])
      ? stored[STORAGE_TIMED_ACCESS_SITES_KEY]
      : [];
    const sessions = Array.isArray(stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY])
      ? stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY]
      : [];
    const leisureSites = Array.isArray(stored[STORAGE_LEISURE_SITES_KEY])
      ? stored[STORAGE_LEISURE_SITES_KEY]
      : [];
    if (findAccessSite(window.location, leisureSites)) {
      clearTimedAccessTimer();
      removeTimedAccessModal();
      return;
    }
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
      STORAGE_TIMED_ACCESS_SITES_KEY,
      STORAGE_LEISURE_SITES_KEY
    ]);
    const blockedPaths = Array.isArray(stored[STORAGE_BLOCKED_PATHS_KEY])
      ? stored[STORAGE_BLOCKED_PATHS_KEY]
      : [];
    const timedAccessSites = Array.isArray(stored[STORAGE_TIMED_ACCESS_SITES_KEY])
      ? stored[STORAGE_TIMED_ACCESS_SITES_KEY]
      : [];
    const leisureSites = Array.isArray(stored[STORAGE_LEISURE_SITES_KEY])
      ? stored[STORAGE_LEISURE_SITES_KEY]
      : [];

    if (
      timedAccessSites.some((site) => matchesTimedAccessPattern(window.location, site)) ||
      leisureSites.some((site) => matchesTimedAccessPattern(window.location, site))
    ) {
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

function scheduleLeisureCheck() {
  window.setTimeout(enforceLeisureAccess, 0);
}

function checkUrlForTimedAccessChange() {
  if (redirecting || window.location.href === lastTimedAccessUrl) {
    return;
  }

  scheduleTimedAccessCheck();
  scheduleLeisureCheck();
}

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function pushState(...args) {
  const result = originalPushState.apply(this, args);
  scheduleBlockedPathCheck();
  scheduleTimedAccessCheck();
  scheduleLeisureCheck();
  return result;
};

history.replaceState = function replaceState(...args) {
  const result = originalReplaceState.apply(this, args);
  scheduleBlockedPathCheck();
  scheduleTimedAccessCheck();
  scheduleLeisureCheck();
  return result;
};

window.addEventListener("popstate", scheduleBlockedPathCheck);
window.addEventListener("hashchange", scheduleBlockedPathCheck);
window.addEventListener("pageshow", scheduleBlockedPathCheck);
window.addEventListener("popstate", scheduleTimedAccessCheck);
window.addEventListener("hashchange", scheduleTimedAccessCheck);
window.addEventListener("pageshow", scheduleTimedAccessCheck);
window.addEventListener("popstate", scheduleLeisureCheck);
window.addEventListener("hashchange", scheduleLeisureCheck);
window.addEventListener("pageshow", scheduleLeisureCheck);
window.addEventListener("focus", scheduleLeisureCheck);
window.addEventListener("blur", () => {
  pauseLeisure();
  removeLeisureModal();
});
window.addEventListener("beforeunload", pauseLeisure);
document.addEventListener("play", () => {
  if (timedAccessModal || leisureModal) {
    pausePageMedia();
  }
}, true);
document.addEventListener("visibilitychange", () => {
  scheduleBlockedPathCheck();
  scheduleTimedAccessCheck();
  if (document.hidden) {
    pauseLeisure();
    removeLeisureModal();
  } else {
    scheduleLeisureCheck();
  }
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (
    changes[STORAGE_BLOCKED_PATHS_KEY] ||
    changes[STORAGE_TIMED_ACCESS_SITES_KEY] ||
    changes[STORAGE_LEISURE_SITES_KEY]
  ) {
    lastCheckedUrl = "";
    scheduleBlockedPathCheck();
  }

  if (changes[STORAGE_TIMED_ACCESS_SITES_KEY] || changes[STORAGE_TIMED_ACCESS_SESSIONS_KEY]) {
    scheduleTimedAccessCheck();
  }

  if (changes[STORAGE_LEISURE_SITES_KEY]) {
    scheduleLeisureCheck();
  }
});

scheduleBlockedPathCheck();
scheduleTimedAccessCheck();
scheduleLeisureCheck();
window.setInterval(enforceBlockedPath, 1000);
window.setInterval(checkUrlForTimedAccessChange, 500);
window.setInterval(() => {
  if (!redirecting && window.location.href !== lastLeisureUrl) {
    scheduleLeisureCheck();
  }
}, 500);
