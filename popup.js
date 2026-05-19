const STORAGE_BLOCKED_SITES_KEY = "blockedSites";
const STORAGE_NEXT_RULE_ID_KEY = "nextBlockedSiteRuleId";

const form = document.getElementById("add-site-form");
const domainInput = document.getElementById("site-domain");
const statusElement = document.getElementById("status");
const sitesList = document.getElementById("blocked-sites");

function normalizeDomain(value) {
  const trimmed = value.trim().toLowerCase();

  if (
    !trimmed ||
    trimmed.includes("://") ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    return null;
  }

  const domain = trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
  const hostnamePattern =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

  return hostnamePattern.test(domain) ? domain : null;
}

async function getStoredState() {
  const stored = await chrome.storage.local.get([
    STORAGE_BLOCKED_SITES_KEY,
    STORAGE_NEXT_RULE_ID_KEY
  ]);
  const blockedSites = Array.isArray(stored[STORAGE_BLOCKED_SITES_KEY])
    ? stored[STORAGE_BLOCKED_SITES_KEY]
    : [];
  const fallbackNextRuleId =
    Math.max(...blockedSites.map((site) => site.id || 0), 0) + 1;

  return {
    blockedSites,
    nextRuleId: Number.isInteger(stored[STORAGE_NEXT_RULE_ID_KEY])
      ? stored[STORAGE_NEXT_RULE_ID_KEY]
      : fallbackNextRuleId
  };
}

function setStatus(message) {
  statusElement.textContent = message;
}

async function syncRules() {
  const response = await chrome.runtime.sendMessage({ action: "syncBlockedSites" });
  if (!response || !response.ok) {
    throw new Error("Rule sync failed.");
  }
}

async function saveState(blockedSites, nextRuleId) {
  await chrome.storage.local.set({
    [STORAGE_BLOCKED_SITES_KEY]: blockedSites,
    [STORAGE_NEXT_RULE_ID_KEY]: nextRuleId
  });
  await syncRules();
}

function renderSites(blockedSites) {
  sitesList.textContent = "";

  if (blockedSites.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = "No blocked sites yet.";
    sitesList.append(emptyItem);
    return;
  }

  blockedSites
    .slice()
    .sort((first, second) => first.domain.localeCompare(second.domain))
    .forEach((site) => {
      const item = document.createElement("li");
      const domain = document.createElement("span");
      const removeButton = document.createElement("button");

      domain.className = "domain";
      domain.textContent = site.domain;
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.dataset.domain = site.domain;

      item.append(domain, removeButton);
      sitesList.append(item);
    });
}

async function loadAndRender() {
  await syncRules();
  const { blockedSites } = await getStoredState();
  renderSites(blockedSites);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const domain = normalizeDomain(domainInput.value);
  if (!domain) {
    setStatus("Enter a domain only, like youtube.com.");
    return;
  }

  const { blockedSites, nextRuleId } = await getStoredState();

  if (blockedSites.some((site) => site.domain === domain)) {
    setStatus(`${domain} is already blocked.`);
    return;
  }

  const updatedSites = blockedSites.concat({ id: nextRuleId, domain });
  try {
    await saveState(updatedSites, nextRuleId + 1);
  } catch (error) {
    console.error("Failed to add blocked site", error);
    setStatus(`Could not add ${domain}.`);
    return;
  }

  domainInput.value = "";
  setStatus(`${domain} added.`);
  renderSites(updatedSites);
});

sitesList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-domain]");
  if (!removeButton) {
    return;
  }

  const domain = removeButton.dataset.domain;
  const firstConfirmed = confirm(`Remove ${domain} from blocked sites?`);
  if (!firstConfirmed) {
    setStatus(`${domain} kept blocked.`);
    return;
  }

  const typedDomain = prompt(`Type ${domain} to confirm removal.`);
  if ((typedDomain || "").trim().toLowerCase() !== domain) {
    setStatus(`${domain} kept blocked.`);
    return;
  }

  const { blockedSites, nextRuleId } = await getStoredState();
  const updatedSites = blockedSites.filter((site) => site.domain !== domain);

  try {
    await saveState(updatedSites, nextRuleId);
  } catch (error) {
    console.error("Failed to remove blocked site", error);
    setStatus(`Could not remove ${domain}.`);
    return;
  }

  setStatus(`${domain} removed.`);
  renderSites(updatedSites);
});

loadAndRender().catch((error) => {
  console.error("Failed to load popup state", error);
  setStatus("Could not load blocked sites.");
});
