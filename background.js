// background.js

importScripts("blocked-sites.js");

const DEFAULT_RESOURCE_TYPES = ["main_frame"];
const STORAGE_BLOCKED_SITES_KEY = "blockedSites";
const STORAGE_ALLOWED_PATHS_KEY = "allowedPaths";
const STORAGE_BLOCKED_PATHS_KEY = "blockedPaths";
const STORAGE_TIMED_ACCESS_SITES_KEY = "timedAccessSites";
const STORAGE_TIMED_ACCESS_SESSIONS_KEY = "timedAccessSessions";
const STORAGE_TIMED_ACCESS_MOOD_LOG_KEY = "timedAccessMoodLog";
const STORAGE_INTERVENTION_LOG_KEY = "interventionLog";
const STORAGE_INTERVENTION_LOG_MIGRATED_KEY = "interventionLogMigratedFromMoodLog";
const STORAGE_LEISURE_SITES_KEY = "leisureSites";
const STORAGE_LEISURE_PERIOD_STATE_KEY = "leisurePeriodState";
const STORAGE_NEXT_RULE_ID_KEY = "nextBlockedSiteRuleId";
const DEFAULT_WORK_DURATION_MINUTES = 10;
const LEISURE_PERIOD_BUDGET_MS = 15 * 60 * 1000;
const LEISURE_HEARTBEAT_STALE_MS = 3000;
let leisureOperationQueue = Promise.resolve();
let interventionLogQueue = Promise.resolve();

function queueLeisureOperation(operation) {
  const result = leisureOperationQueue.then(operation, operation);
  leisureOperationQueue = result.catch(() => {});
  return result;
}

function queueInterventionLogOperation(operation) {
  const result = interventionLogQueue.then(operation, operation);
  interventionLogQueue = result.catch(() => {});
  return result;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitPattern(pattern) {
  const slashIndex = pattern.indexOf("/");
  if (slashIndex === -1) {
    return null;
  }

  return {
    domain: pattern.slice(0, slashIndex),
    path: pattern.slice(slashIndex)
  };
}

function buildRootAndWwwPathRegex(pattern) {
  const parts = splitPattern(pattern);
  if (!parts) {
    return null;
  }

  const path = parts.path.endsWith("/*") ? parts.path.slice(0, -2) : parts.path;
  return `^https?://(www\\.)?${escapeRegex(parts.domain)}${escapeRegex(path)}(?:/.*)?(?:\\?.*)?$`;
}

function buildRedirectRule(site) {
  return {
    id: site.id,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/video.html"
      }
    },
    condition: {
      urlFilter: `||${site.domain}^`,
      resourceTypes: DEFAULT_RESOURCE_TYPES
    }
  };
}

function buildBlockedPathRule(path) {
  return {
    id: path.id,
    priority: 4,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/video.html"
      }
    },
    condition: {
      regexFilter: buildRootAndWwwPathRegex(path.pattern),
      resourceTypes: DEFAULT_RESOURCE_TYPES
    }
  };
}

function buildAllowRule(path) {
  return {
    id: path.id,
    priority: 5,
    action: {
      type: "allow"
    },
    condition: {
      urlFilter: `||${path.pattern}`,
      resourceTypes: DEFAULT_RESOURCE_TYPES
    }
  };
}

function getFromStorage(keys) {
  return chrome.storage.local.get(keys);
}

function makeWorkUrl(domain) {
  return `https://www.${domain}/`;
}

function cleanSiteList(items) {
  return items.filter((item) => item && item.domain);
}

function cleanPathList(items) {
  return items.filter((item) => item && item.pattern);
}

function cleanSessionList(items) {
  return items.filter(
    (item) =>
      item &&
      item.domain &&
      Number.isInteger(item.expiresAt)
  );
}

function getTimedAccessKey(site) {
  return site.pattern || site.domain;
}

function getAccessKey(site) {
  return site.pattern || site.domain;
}

function getLocalDateFields(createdAt) {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return {
    localDate: `${year}-${month}-${day}`,
    localHour: date.getHours(),
    localDay: date.getDay()
  };
}

function sanitizeInterventionEvent(event, fallbackId = Date.now()) {
  const createdAt = Number.isFinite(event.createdAt) ? event.createdAt : Date.now();
  const localFields = getLocalDateFields(createdAt);

  return {
    id: event.id || `${createdAt}-${fallbackId}`,
    createdAt,
    ...localFields,
    url: typeof event.url === "string" ? event.url : "",
    hostname: typeof event.hostname === "string" ? event.hostname : "",
    accessKey: typeof event.accessKey === "string" ? event.accessKey : "",
    interventionType: typeof event.interventionType === "string"
      ? event.interventionType
      : "unknown",
    choice: typeof event.choice === "string" ? event.choice : "unknown",
    ...(typeof event.reason === "string" ? { reason: event.reason } : {}),
    ...(typeof event.label === "string" ? { label: event.label } : {})
  };
}

function migrateMoodEntry(entry, index) {
  const reason = entry.mood === "scared_of_failure"
    ? "avoiding_failure"
    : entry.mood;

  return sanitizeInterventionEvent({
    id: entry.id,
    createdAt: entry.createdAt,
    url: entry.url,
    hostname: entry.hostname,
    accessKey: entry.accessKey,
    interventionType: "timed_access",
    choice: "reason",
    reason,
    label: entry.label
  }, index);
}

async function migrateTimedAccessMoodLogIfNeeded() {
  const stored = await getFromStorage([
    STORAGE_TIMED_ACCESS_MOOD_LOG_KEY,
    STORAGE_INTERVENTION_LOG_KEY,
    STORAGE_INTERVENTION_LOG_MIGRATED_KEY
  ]);

  if (stored[STORAGE_INTERVENTION_LOG_MIGRATED_KEY]) {
    return;
  }

  const moodLog = Array.isArray(stored[STORAGE_TIMED_ACCESS_MOOD_LOG_KEY])
    ? stored[STORAGE_TIMED_ACCESS_MOOD_LOG_KEY]
    : [];
  const interventionLog = Array.isArray(stored[STORAGE_INTERVENTION_LOG_KEY])
    ? stored[STORAGE_INTERVENTION_LOG_KEY]
    : [];

  if (moodLog.length === 0) {
    await chrome.storage.local.set({
      [STORAGE_INTERVENTION_LOG_MIGRATED_KEY]: true
    });
    return;
  }

  const existingIds = new Set(interventionLog.map((entry) => entry && entry.id));
  const migratedEntries = moodLog
    .map(migrateMoodEntry)
    .filter((entry) => !existingIds.has(entry.id));

  await chrome.storage.local.set({
    [STORAGE_INTERVENTION_LOG_KEY]: interventionLog.concat(migratedEntries),
    [STORAGE_INTERVENTION_LOG_MIGRATED_KEY]: true
  });
}

async function appendInterventionEvent(event) {
  await migrateTimedAccessMoodLogIfNeeded();

  const stored = await getFromStorage([STORAGE_INTERVENTION_LOG_KEY]);
  const interventionLog = Array.isArray(stored[STORAGE_INTERVENTION_LOG_KEY])
    ? stored[STORAGE_INTERVENTION_LOG_KEY]
    : [];
  const nextEntry = sanitizeInterventionEvent(event, interventionLog.length + 1);

  await chrome.storage.local.set({
    [STORAGE_INTERVENTION_LOG_KEY]: interventionLog.concat(nextEntry)
  });

  return nextEntry;
}

function recordInterventionEvent(event) {
  return queueInterventionLogOperation(() => appendInterventionEvent(event));
}

function getLeisurePeriod(now = new Date()) {
  const hour = now.getHours();
  if (hour < 6) {
    return null;
  }

  const startHour = hour < 12 ? 6 : hour < 18 ? 12 : 18;
  const endHour = startHour + 6;
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const periodEnd = new Date(now);
  periodEnd.setHours(endHour, 0, 0, 0);

  return {
    id: `${year}-${month}-${day}:${startHour}`,
    label: startHour === 6 ? "Morning" : startHour === 12 ? "Midday" : "Evening",
    endsAt: periodEnd.getTime()
  };
}

function makeFreshLeisureState(period) {
  return {
    periodId: period.id,
    remainingMs: LEISURE_PERIOD_BUDGET_MS,
    activeTabId: null,
    activeSince: null,
    lastHeartbeatAt: null
  };
}

function normalizeLeisureState(value, nowMs = Date.now()) {
  const period = getLeisurePeriod(new Date(nowMs));
  if (!period) {
    return { period: null, state: null };
  }

  if (!value || value.periodId !== period.id) {
    return { period, state: makeFreshLeisureState(period) };
  }

  const state = {
    periodId: period.id,
    remainingMs: Math.max(
      Math.min(Number(value.remainingMs) || 0, LEISURE_PERIOD_BUDGET_MS),
      0
    ),
    activeTabId: Number.isInteger(value.activeTabId) ? value.activeTabId : null,
    activeSince: Number.isFinite(value.activeSince) ? value.activeSince : null,
    lastHeartbeatAt: Number.isFinite(value.lastHeartbeatAt)
      ? value.lastHeartbeatAt
      : null
  };

  if (state.activeTabId !== null && state.activeSince !== null) {
    const chargeUntil = state.lastHeartbeatAt && nowMs - state.lastHeartbeatAt > LEISURE_HEARTBEAT_STALE_MS
      ? Math.min(nowMs, state.lastHeartbeatAt + LEISURE_HEARTBEAT_STALE_MS)
      : nowMs;
    state.remainingMs = Math.max(state.remainingMs - Math.max(chargeUntil - state.activeSince, 0), 0);
    state.activeSince = chargeUntil;

    if (chargeUntil < nowMs || state.remainingMs === 0 || nowMs >= period.endsAt) {
      state.activeTabId = null;
      state.activeSince = null;
      state.lastHeartbeatAt = null;
    }
  }

  return { period, state };
}

function getLeisureStatusPayload(period, state, tabId = null) {
  if (!period || !state) {
    return { ok: true, available: false, status: "unavailable", remainingMs: 0 };
  }

  return {
    ok: true,
    available: state.remainingMs > 0,
    status: state.remainingMs === 0
      ? "exhausted"
      : state.activeTabId === null
        ? "paused"
        : state.activeTabId === tabId
          ? "active"
          : "active-elsewhere",
    periodId: period.id,
    periodLabel: period.label,
    periodEndsAt: period.endsAt,
    remainingMs: state.remainingMs,
    ownsLease: state.activeTabId === tabId
  };
}

function ensureUniqueRuleIds(
  blockedSites,
  allowedPaths,
  blockedPaths,
  timedAccessSites,
  leisureSites,
  nextRuleId
) {
  const usedIds = new Set();
  let nextAvailableId = Math.max(nextRuleId || 1, 1);
  let changed = false;

  function reserveId(item) {
    if (Number.isInteger(item.id) && item.id > 0 && !usedIds.has(item.id)) {
      usedIds.add(item.id);
      nextAvailableId = Math.max(nextAvailableId, item.id + 1);
      return item;
    }

    while (usedIds.has(nextAvailableId)) {
      nextAvailableId += 1;
    }

    usedIds.add(nextAvailableId);
    changed = true;

    return {
      ...item,
      id: nextAvailableId++
    };
  }

  return {
    blockedSites: blockedSites.map(reserveId),
    allowedPaths: allowedPaths.map(reserveId),
    blockedPaths: blockedPaths.map(reserveId),
    timedAccessSites: timedAccessSites.map((site) =>
      reserveId({
        ...site,
        durationMinutes: Number.isInteger(site.durationMinutes)
          ? site.durationMinutes
          : DEFAULT_WORK_DURATION_MINUTES,
        workUrl: site.workUrl || makeWorkUrl(site.domain)
      })
    ),
    leisureSites: leisureSites.map(reserveId),
    nextRuleId: nextAvailableId,
    changed
  };
}

function splitActiveSessions(sessions) {
  const now = Date.now();
  return {
    activeSessions: sessions.filter((session) => session.expiresAt > now),
    expiredSessions: sessions.filter((session) => session.expiresAt <= now)
  };
}

async function seedStoredRulesIfMissing() {
  const stored = await getFromStorage([
    STORAGE_BLOCKED_SITES_KEY,
    STORAGE_ALLOWED_PATHS_KEY,
    STORAGE_BLOCKED_PATHS_KEY,
    STORAGE_TIMED_ACCESS_SITES_KEY,
    STORAGE_TIMED_ACCESS_SESSIONS_KEY,
    STORAGE_LEISURE_SITES_KEY,
    STORAGE_LEISURE_PERIOD_STATE_KEY,
    STORAGE_NEXT_RULE_ID_KEY
  ]);
  const updates = {};
  let blockedSites = stored[STORAGE_BLOCKED_SITES_KEY];
  let allowedPaths = stored[STORAGE_ALLOWED_PATHS_KEY];
  let blockedPaths = stored[STORAGE_BLOCKED_PATHS_KEY];
  let timedAccessSites = stored[STORAGE_TIMED_ACCESS_SITES_KEY];
  let timedAccessSessions = stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY];
  let leisureSites = stored[STORAGE_LEISURE_SITES_KEY];

  if (!Array.isArray(blockedSites)) {
    blockedSites = self.BLOCKED_SITE_SEEDS.map((site) => ({
      id: site.id,
      domain: site.domain
    }));
    updates[STORAGE_BLOCKED_SITES_KEY] = blockedSites;
  }

  if (!Array.isArray(allowedPaths)) {
    allowedPaths = self.ALLOWED_PATH_SEEDS.map((path) => ({
      id: path.id,
      pattern: path.pattern
    }));
    updates[STORAGE_ALLOWED_PATHS_KEY] = allowedPaths;
  }

  if (!Array.isArray(blockedPaths)) {
    blockedPaths = [];
    updates[STORAGE_BLOCKED_PATHS_KEY] = blockedPaths;
  }

  if (!Array.isArray(timedAccessSites)) {
    timedAccessSites = [];
    updates[STORAGE_TIMED_ACCESS_SITES_KEY] = timedAccessSites;
  }

  if (!Array.isArray(timedAccessSessions)) {
    timedAccessSessions = [];
    updates[STORAGE_TIMED_ACCESS_SESSIONS_KEY] = timedAccessSessions;
  }

  if (!Array.isArray(leisureSites)) {
    leisureSites = [];
    updates[STORAGE_LEISURE_SITES_KEY] = leisureSites;
  }

  blockedSites = cleanSiteList(blockedSites);
  allowedPaths = cleanPathList(allowedPaths);
  blockedPaths = cleanPathList(blockedPaths);
  timedAccessSites = cleanSiteList(timedAccessSites);
  timedAccessSessions = cleanSessionList(timedAccessSessions);
  leisureSites = cleanSiteList(leisureSites);

  const sanitized = ensureUniqueRuleIds(
    blockedSites,
    allowedPaths,
    blockedPaths,
    timedAccessSites,
    leisureSites,
    stored[STORAGE_NEXT_RULE_ID_KEY]
  );
  blockedSites = sanitized.blockedSites;
  allowedPaths = sanitized.allowedPaths;
  blockedPaths = sanitized.blockedPaths;
  timedAccessSites = sanitized.timedAccessSites;
  leisureSites = sanitized.leisureSites;

  const timedKeys = new Set(timedAccessSites.map(getTimedAccessKey));
  const sessionCountBeforeDomainFilter = timedAccessSessions.length;
  const configuredSessions = timedAccessSessions.filter((session) =>
    timedKeys.has(session.domain)
  );
  const sessionSplit = splitActiveSessions(configuredSessions);
  timedAccessSessions = sessionSplit.activeSessions;

  if (sanitized.changed) {
    updates[STORAGE_BLOCKED_SITES_KEY] = blockedSites;
    updates[STORAGE_ALLOWED_PATHS_KEY] = allowedPaths;
    updates[STORAGE_BLOCKED_PATHS_KEY] = blockedPaths;
    updates[STORAGE_TIMED_ACCESS_SITES_KEY] = timedAccessSites;
    updates[STORAGE_TIMED_ACCESS_SESSIONS_KEY] = timedAccessSessions;
    updates[STORAGE_LEISURE_SITES_KEY] = leisureSites;
  }

  if (sessionSplit.expiredSessions.length > 0) {
    updates[STORAGE_TIMED_ACCESS_SESSIONS_KEY] = timedAccessSessions;
  }

  if (configuredSessions.length !== sessionCountBeforeDomainFilter) {
    updates[STORAGE_TIMED_ACCESS_SESSIONS_KEY] = timedAccessSessions;
  }

  if (
    !Number.isInteger(stored[STORAGE_NEXT_RULE_ID_KEY]) ||
    stored[STORAGE_NEXT_RULE_ID_KEY] < sanitized.nextRuleId
  ) {
    updates[STORAGE_NEXT_RULE_ID_KEY] = sanitized.nextRuleId;
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  const leisure = normalizeLeisureState(stored[STORAGE_LEISURE_PERIOD_STATE_KEY]);
  if (leisure.state && JSON.stringify(leisure.state) !== JSON.stringify(stored[STORAGE_LEISURE_PERIOD_STATE_KEY])) {
    await chrome.storage.local.set({
      [STORAGE_LEISURE_PERIOD_STATE_KEY]: leisure.state
    });
  }

  return {
    blockedSites,
    allowedPaths,
    blockedPaths,
    timedAccessSites,
    timedAccessSessions,
    leisureSites,
    leisurePeriodState: leisure.state,
    nextRuleId: sanitized.nextRuleId
  };
}

async function syncDynamicRules(reason) {
  try {
    const {
      blockedSites,
      allowedPaths,
      blockedPaths,
      timedAccessSites,
      leisureSites
    } = await seedStoredRulesIfMissing();
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const timedAccessPatterns = new Set(
      timedAccessSites.concat(leisureSites)
        .map((site) => site.pattern)
        .filter(Boolean)
    );
    const gatedBlockedPaths = blockedPaths.filter(
      (path) => !timedAccessPatterns.has(path.pattern)
    );

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: allowedPaths
        .map(buildAllowRule)
        .concat(
          gatedBlockedPaths.map(buildBlockedPathRule),
          blockedSites.map(buildRedirectRule)
        )
    });
    console.log(`Dynamic rules synced: ${reason}`);
    return true;
  } catch (error) {
    console.error(`Failed to sync dynamic rules: ${reason}`, error);
    return false;
  }
}

async function getLeisureStatus(tabId = null) {
  const stored = await getFromStorage([STORAGE_LEISURE_PERIOD_STATE_KEY]);
  const storedState = stored[STORAGE_LEISURE_PERIOD_STATE_KEY];
  const leisure = normalizeLeisureState(storedState);
  if (leisure.state && JSON.stringify(leisure.state) !== JSON.stringify(storedState)) {
    await chrome.storage.local.set({ [STORAGE_LEISURE_PERIOD_STATE_KEY]: leisure.state });
  }
  return getLeisureStatusPayload(leisure.period, leisure.state, tabId);
}

async function startLeisure(tabId, accessKey) {
  const state = await seedStoredRulesIfMissing();
  if (!state.leisureSites.some((site) => getAccessKey(site) === accessKey)) {
    throw new Error(`${accessKey} is not a leisure site.`);
  }

  const stored = await getFromStorage([STORAGE_LEISURE_PERIOD_STATE_KEY]);
  const leisure = normalizeLeisureState(stored[STORAGE_LEISURE_PERIOD_STATE_KEY]);
  if (!leisure.period || !leisure.state || leisure.state.remainingMs <= 0) {
    return getLeisureStatusPayload(leisure.period, leisure.state, tabId);
  }

  leisure.state.activeTabId = tabId;
  leisure.state.activeSince = Date.now();
  leisure.state.lastHeartbeatAt = leisure.state.activeSince;
  await chrome.storage.local.set({ [STORAGE_LEISURE_PERIOD_STATE_KEY]: leisure.state });
  return getLeisureStatusPayload(leisure.period, leisure.state, tabId);
}

async function heartbeatLeisure(tabId) {
  const stored = await getFromStorage([STORAGE_LEISURE_PERIOD_STATE_KEY]);
  const leisure = normalizeLeisureState(stored[STORAGE_LEISURE_PERIOD_STATE_KEY]);
  if (!leisure.period || !leisure.state || leisure.state.activeTabId !== tabId) {
    if (leisure.state) {
      await chrome.storage.local.set({ [STORAGE_LEISURE_PERIOD_STATE_KEY]: leisure.state });
    }
    return getLeisureStatusPayload(leisure.period, leisure.state, tabId);
  }

  const now = Date.now();
  leisure.state.lastHeartbeatAt = now;
  leisure.state.activeSince = now;
  if (leisure.state.remainingMs <= 0 || now >= leisure.period.endsAt) {
    leisure.state.activeTabId = null;
    leisure.state.activeSince = null;
    leisure.state.lastHeartbeatAt = null;
  }
  await chrome.storage.local.set({ [STORAGE_LEISURE_PERIOD_STATE_KEY]: leisure.state });
  return getLeisureStatusPayload(leisure.period, leisure.state, tabId);
}

async function pauseLeisure(tabId) {
  const stored = await getFromStorage([STORAGE_LEISURE_PERIOD_STATE_KEY]);
  const leisure = normalizeLeisureState(stored[STORAGE_LEISURE_PERIOD_STATE_KEY]);
  if (leisure.state && leisure.state.activeTabId === tabId) {
    leisure.state.activeTabId = null;
    leisure.state.activeSince = null;
    leisure.state.lastHeartbeatAt = null;
    await chrome.storage.local.set({ [STORAGE_LEISURE_PERIOD_STATE_KEY]: leisure.state });
  }
  return getLeisureStatusPayload(leisure.period, leisure.state, tabId);
}

async function activateTimedAccess(domain) {
  const state = await seedStoredRulesIfMissing();
  const site = state.timedAccessSites.find(
    (item) => getTimedAccessKey(item) === domain
  );

  if (!site) {
    throw new Error(`${domain} is not a timed access site.`);
  }

  const expiresAt = Date.now() + site.durationMinutes * 60 * 1000;
  const sessions = state.timedAccessSessions
    .filter((session) => session.domain !== domain)
    .concat({ domain, expiresAt });

  await chrome.storage.local.set({
    [STORAGE_TIMED_ACCESS_SESSIONS_KEY]: sessions
  });
  await syncDynamicRules("timed access started");

  return {
    ok: true,
    domain,
    expiresAt,
    workUrl: site.workUrl || makeWorkUrl(domain)
  };
}

async function recordDnrRedirect(matchInfo) {
  if (
    !matchInfo ||
    !matchInfo.rule ||
    !Number.isInteger(matchInfo.rule.ruleId) ||
    !matchInfo.request ||
    matchInfo.request.type !== "main_frame"
  ) {
    return;
  }

  const state = await seedStoredRulesIfMissing();
  const ruleId = matchInfo.rule.ruleId;
  const blockedSite = state.blockedSites.find((site) => site.id === ruleId);
  const blockedPath = state.blockedPaths.find((path) => path.id === ruleId);
  const target = blockedSite || blockedPath;

  if (!target) {
    return;
  }

  let hostname = "";
  try {
    hostname = new URL(matchInfo.request.url).hostname;
  } catch (error) {
    hostname = "";
  }

  await recordInterventionEvent({
    url: matchInfo.request.url,
    hostname,
    accessKey: blockedPath ? blockedPath.pattern : blockedSite.domain,
    interventionType: blockedPath ? "blocked_path" : "blocked_site",
    choice: "blocked_redirect",
    label: blockedPath ? "Blocked path redirect" : "Blocked site redirect"
  });
}

chrome.runtime.onInstalled.addListener(() => {
  migrateTimedAccessMoodLogIfNeeded().catch((error) => {
    console.error("Failed to migrate timed access mood log", error);
  });
  syncDynamicRules("installed or updated");
});

chrome.runtime.onStartup.addListener(() => {
  migrateTimedAccessMoodLogIfNeeded().catch((error) => {
    console.error("Failed to migrate timed access mood log", error);
  });
  syncDynamicRules("browser startup");
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((matchInfo) => {
    recordDnrRedirect(matchInfo).catch((error) => {
      console.error("Failed to record DNR redirect", error);
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) {
    return false;
  }

  if (message.action === "syncBlockedSites") {
    syncDynamicRules("popup update")
      .then((ok) => sendResponse({ ok }))
      .catch((error) => {
        console.error("Popup requested rule sync failed", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  if (message.action === "startTimedAccess") {
    activateTimedAccess(message.domain)
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error("Timed access start failed", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  if (message.action === "recordInterventionEvent") {
    recordInterventionEvent(message.event || {})
      .then((entry) => sendResponse({ ok: true, entry }))
      .catch((error) => {
        console.error("Intervention logging failed", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  if (message.action === "migrateInterventionLog") {
    migrateTimedAccessMoodLogIfNeeded()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("Intervention log migration failed", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  if (["getLeisureStatus", "startLeisure", "heartbeatLeisure", "pauseLeisure"].includes(message.action)) {
    if (!sender.tab || !Number.isInteger(sender.tab.id)) {
      queueLeisureOperation(() => getLeisureStatus())
        .then((response) => sendResponse(response))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    const action = queueLeisureOperation(() => (
      message.action === "startLeisure"
        ? startLeisure(sender.tab.id, message.accessKey)
        : message.action === "heartbeatLeisure"
          ? heartbeatLeisure(sender.tab.id)
          : message.action === "pauseLeisure"
            ? pauseLeisure(sender.tab.id)
            : getLeisureStatus(sender.tab.id)
    ));
    action
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.action === "redirectTabToVideo") {
    if (!sender.tab || !Number.isInteger(sender.tab.id)) {
      sendResponse({ ok: false, error: "No sender tab available." });
      return false;
    }

    chrome.tabs.update(sender.tab.id, {
      url: chrome.runtime.getURL("video.html")
    }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
