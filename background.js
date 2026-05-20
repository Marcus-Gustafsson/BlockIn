// background.js

importScripts("blocked-sites.js");

const DEFAULT_RESOURCE_TYPES = ["main_frame"];
const STORAGE_BLOCKED_SITES_KEY = "blockedSites";
const STORAGE_ALLOWED_PATHS_KEY = "allowedPaths";
const STORAGE_BLOCKED_PATHS_KEY = "blockedPaths";
const STORAGE_TIMED_ACCESS_SITES_KEY = "timedAccessSites";
const STORAGE_TIMED_ACCESS_SESSIONS_KEY = "timedAccessSessions";
const STORAGE_NEXT_RULE_ID_KEY = "nextBlockedSiteRuleId";
const DEFAULT_WORK_DURATION_MINUTES = 1;

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

function ensureUniqueRuleIds(
  blockedSites,
  allowedPaths,
  blockedPaths,
  timedAccessSites,
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
    STORAGE_NEXT_RULE_ID_KEY
  ]);
  const updates = {};
  let blockedSites = stored[STORAGE_BLOCKED_SITES_KEY];
  let allowedPaths = stored[STORAGE_ALLOWED_PATHS_KEY];
  let blockedPaths = stored[STORAGE_BLOCKED_PATHS_KEY];
  let timedAccessSites = stored[STORAGE_TIMED_ACCESS_SITES_KEY];
  let timedAccessSessions = stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY];

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

  blockedSites = cleanSiteList(blockedSites);
  allowedPaths = cleanPathList(allowedPaths);
  blockedPaths = cleanPathList(blockedPaths);
  timedAccessSites = cleanSiteList(timedAccessSites);
  timedAccessSessions = cleanSessionList(timedAccessSessions);

  const sanitized = ensureUniqueRuleIds(
    blockedSites,
    allowedPaths,
    blockedPaths,
    timedAccessSites,
    stored[STORAGE_NEXT_RULE_ID_KEY]
  );
  blockedSites = sanitized.blockedSites;
  allowedPaths = sanitized.allowedPaths;
  blockedPaths = sanitized.blockedPaths;
  timedAccessSites = sanitized.timedAccessSites;

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

  return {
    blockedSites,
    allowedPaths,
    blockedPaths,
    timedAccessSites,
    timedAccessSessions,
    nextRuleId: sanitized.nextRuleId
  };
}

async function syncDynamicRules(reason) {
  try {
    const {
      blockedSites,
      allowedPaths,
      blockedPaths,
      timedAccessSites
    } = await seedStoredRulesIfMissing();
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const timedAccessPatterns = new Set(
      timedAccessSites
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

chrome.runtime.onInstalled.addListener(() => {
  syncDynamicRules("installed or updated");
});

chrome.runtime.onStartup.addListener(() => {
  syncDynamicRules("browser startup");
});

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
