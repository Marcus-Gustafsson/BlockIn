// background.js

importScripts("blocked-sites.js");

const DEFAULT_RESOURCE_TYPES = ["main_frame"];
const STORAGE_BLOCKED_SITES_KEY = "blockedSites";
const STORAGE_ALLOWED_PATHS_KEY = "allowedPaths";
const STORAGE_NEXT_RULE_ID_KEY = "nextBlockedSiteRuleId";

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

function buildAllowRule(path) {
  return {
    id: path.id,
    priority: 2,
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

function ensureUniqueRuleIds(blockedSites, allowedPaths, nextRuleId) {
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
    nextRuleId: nextAvailableId,
    changed
  };
}

async function seedStoredRulesIfMissing() {
  const stored = await getFromStorage([
    STORAGE_BLOCKED_SITES_KEY,
    STORAGE_ALLOWED_PATHS_KEY,
    STORAGE_NEXT_RULE_ID_KEY
  ]);
  const updates = {};
  let blockedSites = stored[STORAGE_BLOCKED_SITES_KEY];
  let allowedPaths = stored[STORAGE_ALLOWED_PATHS_KEY];

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

  const sanitized = ensureUniqueRuleIds(
    blockedSites,
    allowedPaths,
    stored[STORAGE_NEXT_RULE_ID_KEY]
  );
  blockedSites = sanitized.blockedSites;
  allowedPaths = sanitized.allowedPaths;

  if (sanitized.changed) {
    updates[STORAGE_BLOCKED_SITES_KEY] = blockedSites;
    updates[STORAGE_ALLOWED_PATHS_KEY] = allowedPaths;
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

  return { blockedSites, allowedPaths };
}

async function syncDynamicRules(reason) {
  try {
    const { blockedSites, allowedPaths } = await seedStoredRulesIfMissing();
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: allowedPaths.map(buildAllowRule).concat(
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

chrome.runtime.onInstalled.addListener(() => {
  syncDynamicRules("installed or updated");
});

chrome.runtime.onStartup.addListener(() => {
  syncDynamicRules("browser startup");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== "syncBlockedSites") {
    return false;
  }

  syncDynamicRules("popup update")
    .then((ok) => sendResponse({ ok }))
    .catch((error) => {
      console.error("Popup requested rule sync failed", error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
