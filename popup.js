const STORAGE_BLOCKED_SITES_KEY = "blockedSites";
const STORAGE_ALLOWED_PATHS_KEY = "allowedPaths";
const STORAGE_NEXT_RULE_ID_KEY = "nextBlockedSiteRuleId";

const siteForm = document.getElementById("add-site-form");
const allowedPathForm = document.getElementById("add-allowed-path-form");
const domainInput = document.getElementById("site-domain");
const allowedPathInput = document.getElementById("allowed-path");
const statusElement = document.getElementById("status");
const sitesList = document.getElementById("blocked-sites");
const allowedPathsList = document.getElementById("allowed-paths");

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

function normalizeAllowedPath(value) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }

  let domainAndPath = trimmed;
  try {
    if (trimmed.includes("://")) {
      const url = new URL(trimmed);
      domainAndPath = `${url.hostname}${url.pathname}`;
    }
  } catch (error) {
    return null;
  }

  if (
    domainAndPath.includes("?") ||
    domainAndPath.includes("#") ||
    !domainAndPath.includes("/")
  ) {
    return null;
  }

  const slashIndex = domainAndPath.indexOf("/");
  const domain = normalizeDomain(domainAndPath.slice(0, slashIndex));
  const path = domainAndPath.slice(slashIndex);
  if (!domain || path === "/" || path.includes("//")) {
    return null;
  }

  const basePath =
    domain === "facebook.com" && path.startsWith("/messages/")
      ? "/messages/"
      : path;
  const normalizedPath = basePath.endsWith("*")
    ? basePath
    : `${basePath.replace(/\/+$/, "")}/*`;
  const pathPattern = /^\/[a-z0-9._~!$&'()*+,;=:@%/-]*\*?$/;

  return pathPattern.test(normalizedPath)
    ? `${domain}${normalizedPath}`
    : null;
}

async function getStoredState() {
  const stored = await chrome.storage.local.get([
    STORAGE_BLOCKED_SITES_KEY,
    STORAGE_ALLOWED_PATHS_KEY,
    STORAGE_NEXT_RULE_ID_KEY
  ]);
  const blockedSites = Array.isArray(stored[STORAGE_BLOCKED_SITES_KEY])
    ? stored[STORAGE_BLOCKED_SITES_KEY]
    : [];
  const allowedPaths = Array.isArray(stored[STORAGE_ALLOWED_PATHS_KEY])
    ? stored[STORAGE_ALLOWED_PATHS_KEY]
    : [];
  const nextAvailableRuleId =
    Math.max(
      ...blockedSites.map((site) => site.id || 0),
      ...allowedPaths.map((path) => path.id || 0),
      0
    ) + 1;

  return {
    blockedSites,
    allowedPaths,
    nextRuleId: Number.isInteger(stored[STORAGE_NEXT_RULE_ID_KEY])
      ? Math.max(stored[STORAGE_NEXT_RULE_ID_KEY], nextAvailableRuleId)
      : nextAvailableRuleId
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

async function saveState(blockedSites, allowedPaths, nextRuleId) {
  await chrome.storage.local.set({
    [STORAGE_BLOCKED_SITES_KEY]: blockedSites,
    [STORAGE_ALLOWED_PATHS_KEY]: allowedPaths,
    [STORAGE_NEXT_RULE_ID_KEY]: nextRuleId
  });
  await syncRules();
}

function renderList(list, items, emptyText, textKey, removeDataKey) {
  list.textContent = "";

  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = emptyText;
    list.append(emptyItem);
    return;
  }

  items
    .slice()
    .sort((first, second) => first[textKey].localeCompare(second[textKey]))
    .forEach((itemValue) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const removeButton = document.createElement("button");

      label.className = "domain";
      label.textContent = itemValue[textKey];
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.dataset[removeDataKey] = itemValue[textKey];

      item.append(label, removeButton);
      list.append(item);
    });
}

function renderSites(blockedSites, allowedPaths) {
  sitesList.textContent = "";
  allowedPathsList.textContent = "";

  renderList(sitesList, blockedSites, "No blocked sites yet.", "domain", "domain");
  renderList(
    allowedPathsList,
    allowedPaths,
    "No allowed paths yet.",
    "pattern",
    "pattern"
  );
}

async function loadAndRender() {
  await syncRules();
  const { blockedSites, allowedPaths } = await getStoredState();
  renderSites(blockedSites, allowedPaths);
}

siteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const domain = normalizeDomain(domainInput.value);
  if (!domain) {
    setStatus("Enter a domain only, like youtube.com.");
    return;
  }

  const { blockedSites, allowedPaths, nextRuleId } = await getStoredState();

  if (blockedSites.some((site) => site.domain === domain)) {
    setStatus(`${domain} is already blocked.`);
    return;
  }

  const updatedSites = blockedSites.concat({ id: nextRuleId, domain });
  try {
    await saveState(updatedSites, allowedPaths, nextRuleId + 1);
  } catch (error) {
    console.error("Failed to add blocked site", error);
    setStatus(`Could not add ${domain}.`);
    return;
  }

  domainInput.value = "";
  setStatus(`${domain} added.`);
  renderSites(updatedSites, allowedPaths);
});

allowedPathForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pattern = normalizeAllowedPath(allowedPathInput.value);
  if (!pattern) {
    setStatus("Enter a domain path, like facebook.com/messages/*.");
    return;
  }

  const { blockedSites, allowedPaths, nextRuleId } = await getStoredState();

  if (allowedPaths.some((path) => path.pattern === pattern)) {
    setStatus(`${pattern} is already allowed.`);
    return;
  }

  const updatedPaths = allowedPaths.concat({ id: nextRuleId, pattern });
  try {
    await saveState(blockedSites, updatedPaths, nextRuleId + 1);
  } catch (error) {
    console.error("Failed to add allowed path", error);
    setStatus(`Could not allow ${pattern}.`);
    return;
  }

  allowedPathInput.value = "";
  setStatus(`${pattern} allowed.`);
  renderSites(blockedSites, updatedPaths);
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

  const { blockedSites, allowedPaths, nextRuleId } = await getStoredState();
  const updatedSites = blockedSites.filter((site) => site.domain !== domain);

  try {
    await saveState(updatedSites, allowedPaths, nextRuleId);
  } catch (error) {
    console.error("Failed to remove blocked site", error);
    setStatus(`Could not remove ${domain}.`);
    return;
  }

  setStatus(`${domain} removed.`);
  renderSites(updatedSites, allowedPaths);
});

allowedPathsList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-pattern]");
  if (!removeButton) {
    return;
  }

  const pattern = removeButton.dataset.pattern;
  const { blockedSites, allowedPaths, nextRuleId } = await getStoredState();
  const updatedPaths = allowedPaths.filter((path) => path.pattern !== pattern);

  try {
    await saveState(blockedSites, updatedPaths, nextRuleId);
  } catch (error) {
    console.error("Failed to remove allowed path", error);
    setStatus(`Could not remove ${pattern}.`);
    return;
  }

  setStatus(`${pattern} removed.`);
  renderSites(blockedSites, updatedPaths);
});

loadAndRender().catch((error) => {
  console.error("Failed to load popup state", error);
  setStatus("Could not load blocked sites.");
});
