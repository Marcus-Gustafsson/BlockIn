// background.js

importScripts("blocked-sites.js");

const DEFAULT_RESOURCE_TYPES = ["main_frame"];
const STORAGE_BLOCKED_SITES_KEY = "blockedSites";
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

function getFromStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function seedBlockedSitesIfMissing() {
  const stored = await getFromStorage([
    STORAGE_BLOCKED_SITES_KEY,
    STORAGE_NEXT_RULE_ID_KEY
  ]);

  if (Array.isArray(stored[STORAGE_BLOCKED_SITES_KEY])) {
    return stored[STORAGE_BLOCKED_SITES_KEY];
  }

  const seedSites = self.BLOCKED_SITE_SEEDS.map((site) => ({
    id: site.id,
    domain: site.domain
  }));
  const nextRuleId =
    Math.max(...seedSites.map((site) => site.id), 0) + 1;

  await chrome.storage.local.set({
    [STORAGE_BLOCKED_SITES_KEY]: seedSites,
    [STORAGE_NEXT_RULE_ID_KEY]: nextRuleId
  });

  return seedSites;
}

async function syncDynamicRules(reason) {
  try {
    const blockedSites = await seedBlockedSitesIfMissing();
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: blockedSites.map(buildRedirectRule)
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
