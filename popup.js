const STORAGE_BLOCKED_SITES_KEY = "blockedSites";
const STORAGE_ALLOWED_PATHS_KEY = "allowedPaths";
const STORAGE_BLOCKED_PATHS_KEY = "blockedPaths";
const STORAGE_TIMED_ACCESS_SITES_KEY = "timedAccessSites";
const STORAGE_TIMED_ACCESS_SESSIONS_KEY = "timedAccessSessions";
const STORAGE_LEISURE_SITES_KEY = "leisureSites";
const STORAGE_INTERVENTION_LOG_KEY = "interventionLog";
const STORAGE_NEXT_RULE_ID_KEY = "nextBlockedSiteRuleId";
const DEFAULT_WORK_DURATION_MINUTES = 10;

const siteForm = document.getElementById("add-site-form");
const allowedPathForm = document.getElementById("add-allowed-path-form");
const blockedPathForm = document.getElementById("add-blocked-path-form");
const timedSiteForm = document.getElementById("add-timed-site-form");
const leisureSiteForm = document.getElementById("add-leisure-site-form");
const domainInput = document.getElementById("site-domain");
const allowedPathInput = document.getElementById("allowed-path");
const blockedPathInput = document.getElementById("blocked-path");
const timedSiteInput = document.getElementById("timed-site-domain");
const leisureSiteInput = document.getElementById("leisure-site-domain");
const statusElement = document.getElementById("status");
const sitesList = document.getElementById("blocked-sites");
const allowedPathsList = document.getElementById("allowed-paths");
const blockedPathsList = document.getElementById("blocked-paths");
const timedSitesList = document.getElementById("timed-sites");
const leisureSitesList = document.getElementById("leisure-sites");
const leisurePeriodStatus = document.getElementById("leisure-period-status");
const interventionsTodayElement = document.getElementById("interventions-today");
const interventionsWeekElement = document.getElementById("interventions-week");
const topHoursList = document.getElementById("top-hours");
const topTargetsList = document.getElementById("top-targets");
const topReasonsList = document.getElementById("top-reasons");
const recentInterventionsList = document.getElementById("recent-interventions");
const exportInterventionsJsonButton = document.getElementById("export-interventions-json");
const exportInterventionsCsvButton = document.getElementById("export-interventions-csv");
const clearInterventionsButton = document.getElementById("clear-interventions");
let interventionLogMigrationRequested = false;

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

function normalizePathPattern(value, options = {}) {
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
    options.collapseFacebookMessages &&
    domain === "facebook.com" &&
    path.startsWith("/messages/")
      ? "/messages/"
      : path;
  if (basePath.includes("*") && !basePath.endsWith("/*")) {
    return null;
  }

  const normalizedPath = basePath.endsWith("*")
    ? basePath
    : `${basePath.replace(/\/+$/, "")}/*`;
  const pathPattern = /^\/[a-z0-9._~!$&'()*+,;=:@%/-]*\*?$/;

  return pathPattern.test(normalizedPath)
    ? `${domain}${normalizedPath}`
    : null;
}

function normalizeAllowedPath(value) {
  return normalizePathPattern(value, { collapseFacebookMessages: true });
}

function normalizeBlockedPath(value) {
  return normalizePathPattern(value);
}

function normalizeTimedAccessDomain(value) {
  const trimmed = value.trim();

  try {
    if (trimmed.includes("://")) {
      return normalizeDomain(new URL(trimmed).hostname);
    }
  } catch (error) {
    return null;
  }

  return normalizeDomain(trimmed);
}

function normalizeTimedAccessTarget(value) {
  const pattern = normalizePathPattern(value);
  if (pattern) {
    const slashIndex = pattern.indexOf("/");
    return {
      domain: pattern.slice(0, slashIndex),
      pattern
    };
  }

  const domain = normalizeTimedAccessDomain(value);
  return domain ? { domain } : null;
}

function makeWorkUrl(domain) {
  return `https://www.${domain}/`;
}

async function getStoredState() {
  if (!interventionLogMigrationRequested) {
    interventionLogMigrationRequested = true;
    await chrome.runtime.sendMessage({ action: "migrateInterventionLog" });
  }

  const stored = await chrome.storage.local.get([
    STORAGE_BLOCKED_SITES_KEY,
    STORAGE_ALLOWED_PATHS_KEY,
    STORAGE_BLOCKED_PATHS_KEY,
    STORAGE_TIMED_ACCESS_SITES_KEY,
    STORAGE_TIMED_ACCESS_SESSIONS_KEY,
    STORAGE_LEISURE_SITES_KEY,
    STORAGE_INTERVENTION_LOG_KEY,
    STORAGE_NEXT_RULE_ID_KEY
  ]);
  const blockedSites = Array.isArray(stored[STORAGE_BLOCKED_SITES_KEY])
    ? stored[STORAGE_BLOCKED_SITES_KEY]
    : [];
  const allowedPaths = Array.isArray(stored[STORAGE_ALLOWED_PATHS_KEY])
    ? stored[STORAGE_ALLOWED_PATHS_KEY]
    : [];
  const blockedPaths = Array.isArray(stored[STORAGE_BLOCKED_PATHS_KEY])
    ? stored[STORAGE_BLOCKED_PATHS_KEY]
    : [];
  const timedAccessSites = Array.isArray(stored[STORAGE_TIMED_ACCESS_SITES_KEY])
    ? stored[STORAGE_TIMED_ACCESS_SITES_KEY]
    : [];
  const timedAccessSessions = Array.isArray(stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY])
    ? stored[STORAGE_TIMED_ACCESS_SESSIONS_KEY]
    : [];
  const leisureSites = Array.isArray(stored[STORAGE_LEISURE_SITES_KEY])
    ? stored[STORAGE_LEISURE_SITES_KEY]
    : [];
  const interventionLog = Array.isArray(stored[STORAGE_INTERVENTION_LOG_KEY])
    ? stored[STORAGE_INTERVENTION_LOG_KEY]
    : [];
  const leisureStatus = await chrome.runtime.sendMessage({ action: "getLeisureStatus" });
  const nextAvailableRuleId =
    Math.max(
      ...blockedSites.map((site) => site.id || 0),
      ...allowedPaths.map((path) => path.id || 0),
      ...blockedPaths.map((path) => path.id || 0),
      ...timedAccessSites.map((site) => site.id || 0),
      ...leisureSites.map((site) => site.id || 0),
      0
    ) + 1;

  return {
    blockedSites,
    allowedPaths,
    blockedPaths,
    timedAccessSites,
    timedAccessSessions,
    leisureSites,
    interventionLog,
    leisureStatus,
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

async function saveState(state) {
  await chrome.storage.local.set({
    [STORAGE_BLOCKED_SITES_KEY]: state.blockedSites,
    [STORAGE_ALLOWED_PATHS_KEY]: state.allowedPaths,
    [STORAGE_BLOCKED_PATHS_KEY]: state.blockedPaths,
    [STORAGE_TIMED_ACCESS_SITES_KEY]: state.timedAccessSites,
    [STORAGE_LEISURE_SITES_KEY]: state.leisureSites,
    [STORAGE_NEXT_RULE_ID_KEY]: state.nextRuleId
  });
  await syncRules();
}

function getTimedAccessKey(site) {
  return site.pattern || site.domain;
}

function getAccessKey(site) {
  return site.pattern || site.domain;
}

function renderList(list, items, emptyText, textKey, removeDataKey, metaText, labelText) {
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
    .sort((first, second) => labelText(first).localeCompare(labelText(second)))
    .forEach((itemValue) => {
      const item = document.createElement("li");
      const labelWrapper = document.createElement("span");
      const label = document.createElement("span");
      const removeButton = document.createElement("button");

      label.className = "domain";
      label.textContent = labelText(itemValue);
      labelWrapper.append(label);

      if (metaText) {
        const meta = document.createElement("span");
        meta.className = "meta";
        meta.textContent = metaText(itemValue);
        labelWrapper.append(meta);
      }

      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.dataset[removeDataKey] = labelText(itemValue);

      item.append(labelWrapper, removeButton);
      list.append(item);
    });
}

function formatRemainingTime(milliseconds) {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatHour(hour) {
  const normalizedHour = Number.isInteger(hour) ? hour : 0;
  return `${String(normalizedHour).padStart(2, "0")}:00`;
}

function formatEventTime(createdAt) {
  if (!Number.isFinite(createdAt)) {
    return "Unknown time";
  }

  return new Date(createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatEventLabel(entry) {
  if (entry.label) {
    return entry.label;
  }

  if (entry.reason) {
    return entry.reason.replace(/_/g, " ");
  }

  return (entry.choice || "unknown").replace(/_/g, " ");
}

function incrementCount(counts, key) {
  if (!key) {
    return;
  }

  counts.set(key, (counts.get(key) || 0) + 1);
}

function getTopCounts(entries, getKey, limit) {
  const counts = new Map();
  entries.forEach((entry) => incrementCount(counts, getKey(entry)));

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, limit);
}

function renderCountList(list, items, emptyText) {
  list.textContent = "";

  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = emptyText;
    list.append(emptyItem);
    return;
  }

  items.forEach(([label, count]) => {
    const item = document.createElement("li");
    const strong = document.createElement("span");
    const meta = document.createElement("span");

    strong.className = "domain";
    strong.textContent = label;
    meta.className = "meta";
    meta.textContent = `${count} event${count === 1 ? "" : "s"}`;

    item.append(strong, meta);
    list.append(item);
  });
}

function renderRecentEvents(list, entries) {
  list.textContent = "";

  if (entries.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = "No interventions logged yet.";
    list.append(emptyItem);
    return;
  }

  entries.slice(0, 5).forEach((entry) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const meta = document.createElement("span");

    label.className = "domain";
    label.textContent = `${formatEventLabel(entry)} - ${entry.accessKey || entry.hostname || "unknown target"}`;
    meta.className = "meta";
    meta.textContent = `${formatEventTime(entry.createdAt)} - ${(entry.interventionType || "unknown").replace(/_/g, " ")}`;

    item.append(label, meta);
    list.append(item);
  });
}

function renderInterventionAnalytics(entries) {
  const sortedEntries = entries
    .filter((entry) => entry && Number.isFinite(entry.createdAt))
    .slice()
    .sort((first, second) => second.createdAt - first.createdAt);
  const todayKey = getLocalDateKey();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const todayCount = sortedEntries.filter((entry) => entry.localDate === todayKey).length;
  const weekCount = sortedEntries.filter((entry) => entry.createdAt >= sevenDaysAgo).length;

  interventionsTodayElement.textContent = String(todayCount);
  interventionsWeekElement.textContent = String(weekCount);

  renderCountList(
    topHoursList,
    getTopCounts(sortedEntries, (entry) => formatHour(entry.localHour), 3),
    "No hour trends yet."
  );
  renderCountList(
    topTargetsList,
    getTopCounts(sortedEntries, (entry) => entry.accessKey || entry.hostname, 3),
    "No site trends yet."
  );
  renderCountList(
    topReasonsList,
    getTopCounts(sortedEntries, (entry) => entry.reason || entry.choice, 3)
      .map(([label, count]) => [label.replace(/_/g, " "), count]),
    "No reason trends yet."
  );
  renderRecentEvents(recentInterventionsList, sortedEntries);
}

function getExportDate() {
  return getLocalDateKey();
}

function downloadTextFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function escapeCsvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function convertInterventionsToCsv(entries) {
  const columns = [
    "id",
    "createdAt",
    "localDate",
    "localHour",
    "localDay",
    "url",
    "hostname",
    "accessKey",
    "interventionType",
    "choice",
    "reason",
    "label"
  ];
  const rows = entries.map((entry) =>
    columns.map((column) => escapeCsvValue(entry[column])).join(",")
  );

  return [columns.join(","), ...rows].join("\n");
}

function getActiveTimedAccessSession(accessKey, sessions) {
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

function getTimedAccessMeta(site, sessions) {
  const duration = site.durationMinutes || DEFAULT_WORK_DURATION_MINUTES;
  const workUrl = site.workUrl || makeWorkUrl(site.domain);
  const activeSession = getActiveTimedAccessSession(getTimedAccessKey(site), sessions);

  if (!activeSession) {
    return `${duration} min, inactive, ${workUrl}`;
  }

  return `${duration} min, ${formatRemainingTime(activeSession.expiresAt - Date.now())} left, ${workUrl}`;
}

function renderSites(state) {
  renderInterventionAnalytics(state.interventionLog);

  renderList(
    sitesList,
    state.blockedSites,
    "No blocked sites yet.",
    "domain",
    "domain",
    null,
    (site) => site.domain
  );
  renderList(
    allowedPathsList,
    state.allowedPaths,
    "No allowed paths yet.",
    "pattern",
    "allowedPath",
    null,
    (path) => path.pattern
  );
  renderList(
    blockedPathsList,
    state.blockedPaths,
    "No blocked paths yet.",
    "pattern",
    "blockedPath",
    null,
    (path) => path.pattern
  );
  renderList(
    timedSitesList,
    state.timedAccessSites,
    "No timed access sites yet.",
    "domain",
    "timedDomain",
    (site) => getTimedAccessMeta(site, state.timedAccessSessions),
    getTimedAccessKey
  );
  renderList(
    leisureSitesList,
    state.leisureSites,
    "No leisure sites yet.",
    "domain",
    "leisureTarget",
    null,
    getAccessKey
  );

  const leisureStatus = state.leisureStatus;
  if (!leisureStatus || !leisureStatus.available && leisureStatus.status === "unavailable") {
    leisurePeriodStatus.textContent = "Unavailable 00:00-06:00. Next allowance starts at 06:00.";
  } else {
    const stateLabel = leisureStatus.status === "active-elsewhere"
      ? "active"
      : leisureStatus.status;
    leisurePeriodStatus.textContent = `${leisureStatus.periodLabel}: ${formatRemainingTime(leisureStatus.remainingMs)} remaining, ${stateLabel}.`;
  }
}

async function loadAndRender() {
  await syncRules();
  const state = await getStoredState();
  renderSites(state);
}

siteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const domain = normalizeDomain(domainInput.value);
  if (!domain) {
    setStatus("Enter a domain only, like youtube.com.");
    return;
  }

  const state = await getStoredState();

  if (state.blockedSites.some((site) => site.domain === domain)) {
    setStatus(`${domain} is already blocked.`);
    return;
  }

  if (state.timedAccessSites.some((site) => site.domain === domain)) {
    setStatus(`Remove ${domain} from timed access before blocking the whole site.`);
    return;
  }

  if (state.leisureSites.some((site) => site.domain === domain)) {
    setStatus(`Remove ${domain} from leisure sites before blocking the whole site.`);
    return;
  }

  const updatedState = {
    ...state,
    blockedSites: state.blockedSites.concat({ id: state.nextRuleId, domain }),
    nextRuleId: state.nextRuleId + 1
  };
  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to add blocked site", error);
    setStatus(`Could not add ${domain}.`);
    return;
  }

  domainInput.value = "";
  setStatus(`${domain} added.`);
  renderSites(updatedState);
});

allowedPathForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pattern = normalizeAllowedPath(allowedPathInput.value);
  if (!pattern) {
    setStatus("Enter a domain path, like facebook.com/messages/*.");
    return;
  }

  const state = await getStoredState();

  if (state.allowedPaths.some((path) => path.pattern === pattern)) {
    setStatus(`${pattern} is already allowed.`);
    return;
  }

  const updatedState = {
    ...state,
    allowedPaths: state.allowedPaths.concat({ id: state.nextRuleId, pattern }),
    nextRuleId: state.nextRuleId + 1
  };
  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to add allowed path", error);
    setStatus(`Could not allow ${pattern}.`);
    return;
  }

  allowedPathInput.value = "";
  setStatus(`${pattern} allowed.`);
  renderSites(updatedState);
});

blockedPathForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pattern = normalizeBlockedPath(blockedPathInput.value);
  if (!pattern) {
    setStatus("Enter a domain path, like youtube.com/shorts/*.");
    return;
  }

  const state = await getStoredState();

  if (state.blockedPaths.some((path) => path.pattern === pattern)) {
    setStatus(`${pattern} is already blocked.`);
    return;
  }

  const updatedState = {
    ...state,
    blockedPaths: state.blockedPaths.concat({ id: state.nextRuleId, pattern }),
    nextRuleId: state.nextRuleId + 1
  };
  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to add blocked path", error);
    setStatus(`Could not block ${pattern}.`);
    return;
  }

  blockedPathInput.value = "";
  setStatus(`${pattern} blocked.`);
  renderSites(updatedState);
});

timedSiteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const target = normalizeTimedAccessTarget(timedSiteInput.value);
  if (!target) {
    setStatus("Enter a domain or path, like youtube.com or youtube.com/shorts/*.");
    return;
  }
  const accessKey = target.pattern || target.domain;

  const state = await getStoredState();

  if (state.timedAccessSites.some((site) => getTimedAccessKey(site) === accessKey)) {
    setStatus(`${accessKey} already uses timed access.`);
    return;
  }

  if (state.blockedSites.some((site) => site.domain === target.domain)) {
    setStatus(`Remove ${target.domain} from blocked sites before adding timed access.`);
    return;
  }


  if (state.leisureSites.some((site) => getAccessKey(site) === accessKey)) {
    setStatus(`Remove ${accessKey} from leisure sites before adding timed access.`);
    return;
  }

  const updatedState = {
    ...state,
    timedAccessSites: state.timedAccessSites.concat({
      id: state.nextRuleId,
      domain: target.domain,
      ...(target.pattern ? { pattern: target.pattern } : {}),
      durationMinutes: DEFAULT_WORK_DURATION_MINUTES,
      workUrl: makeWorkUrl(target.domain)
    }),
    nextRuleId: state.nextRuleId + 1
  };
  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to add timed access site", error);
    setStatus(`Could not add timed access for ${accessKey}.`);
    return;
  }

  timedSiteInput.value = "";
  setStatus(`${accessKey} timed access added.`);
  renderSites(updatedState);
});

leisureSiteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const target = normalizeTimedAccessTarget(leisureSiteInput.value);
  if (!target) {
    setStatus("Enter a domain or path, like netflix.com or youtube.com/watch/*.");
    return;
  }
  const accessKey = target.pattern || target.domain;
  const state = await getStoredState();

  if (state.leisureSites.some((site) => getAccessKey(site) === accessKey)) {
    setStatus(`${accessKey} is already a leisure site.`);
    return;
  }
  if (state.blockedSites.some((site) => site.domain === target.domain)) {
    setStatus(`Remove ${target.domain} from blocked sites before adding leisure access.`);
    return;
  }
  if (state.timedAccessSites.some((site) => getTimedAccessKey(site) === accessKey)) {
    setStatus(`Remove ${accessKey} from timed access before adding leisure access.`);
    return;
  }

  const updatedState = {
    ...state,
    leisureSites: state.leisureSites.concat({
      id: state.nextRuleId,
      domain: target.domain,
      ...(target.pattern ? { pattern: target.pattern } : {})
    }),
    nextRuleId: state.nextRuleId + 1
  };

  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to add leisure site", error);
    setStatus(`Could not add leisure access for ${accessKey}.`);
    return;
  }

  leisureSiteInput.value = "";
  setStatus(`${accessKey} leisure access added.`);
  renderSites(updatedState);
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

  const state = await getStoredState();
  const updatedState = {
    ...state,
    blockedSites: state.blockedSites.filter((site) => site.domain !== domain)
  };

  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to remove blocked site", error);
    setStatus(`Could not remove ${domain}.`);
    return;
  }

  setStatus(`${domain} removed.`);
  renderSites(updatedState);
});

allowedPathsList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-allowed-path]");
  if (!removeButton) {
    return;
  }

  const pattern = removeButton.dataset.allowedPath;
  const state = await getStoredState();
  const updatedState = {
    ...state,
    allowedPaths: state.allowedPaths.filter((path) => path.pattern !== pattern)
  };

  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to remove allowed path", error);
    setStatus(`Could not remove ${pattern}.`);
    return;
  }

  setStatus(`${pattern} removed.`);
  renderSites(updatedState);
});

blockedPathsList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-blocked-path]");
  if (!removeButton) {
    return;
  }

  const pattern = removeButton.dataset.blockedPath;
  const state = await getStoredState();
  const updatedState = {
    ...state,
    blockedPaths: state.blockedPaths.filter((path) => path.pattern !== pattern)
  };

  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to remove blocked path", error);
    setStatus(`Could not remove ${pattern}.`);
    return;
  }

  setStatus(`${pattern} removed.`);
  renderSites(updatedState);
});

timedSitesList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-timed-domain]");
  if (!removeButton) {
    return;
  }

  const domain = removeButton.dataset.timedDomain;
  const state = await getStoredState();
  const updatedState = {
    ...state,
    timedAccessSites: state.timedAccessSites.filter(
      (site) => getTimedAccessKey(site) !== domain
    ),
    timedAccessSessions: state.timedAccessSessions.filter(
      (session) => session.domain !== domain
    )
  };

  try {
    await saveState(updatedState);
    await chrome.storage.local.set({
      [STORAGE_TIMED_ACCESS_SESSIONS_KEY]: updatedState.timedAccessSessions
    });
  } catch (error) {
    console.error("Failed to remove timed access site", error);
    setStatus(`Could not remove timed access for ${domain}.`);
    return;
  }

  setStatus(`${domain} timed access removed.`);
  renderSites(updatedState);
});

leisureSitesList.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-leisure-target]");
  if (!removeButton) {
    return;
  }

  const accessKey = removeButton.dataset.leisureTarget;
  const state = await getStoredState();
  const updatedState = {
    ...state,
    leisureSites: state.leisureSites.filter(
      (site) => getAccessKey(site) !== accessKey
    )
  };

  try {
    await saveState(updatedState);
  } catch (error) {
    console.error("Failed to remove leisure site", error);
    setStatus(`Could not remove leisure access for ${accessKey}.`);
    return;
  }

  setStatus(`${accessKey} leisure access removed.`);
  renderSites(updatedState);
});

exportInterventionsJsonButton.addEventListener("click", async () => {
  const state = await getStoredState();
  downloadTextFile(
    `blockin-intervention-log-${getExportDate()}.json`,
    JSON.stringify(state.interventionLog, null, 2),
    "application/json"
  );
  setStatus("Intervention log exported as JSON.");
});

exportInterventionsCsvButton.addEventListener("click", async () => {
  const state = await getStoredState();
  downloadTextFile(
    `blockin-intervention-log-${getExportDate()}.csv`,
    convertInterventionsToCsv(state.interventionLog),
    "text/csv"
  );
  setStatus("Intervention log exported as CSV.");
});

clearInterventionsButton.addEventListener("click", async () => {
  const confirmed = confirm("Clear all local intervention tracking entries?");
  if (!confirmed) {
    setStatus("Intervention log kept.");
    return;
  }

  await chrome.storage.local.set({
    [STORAGE_INTERVENTION_LOG_KEY]: []
  });
  const state = await getStoredState();
  setStatus("Intervention log cleared.");
  renderSites(state);
});

loadAndRender().catch((error) => {
  console.error("Failed to load popup state", error);
  setStatus("Could not load blocked sites.");
});

window.setInterval(() => {
  getStoredState()
    .then(renderSites)
    .catch((error) => console.error("Failed to refresh popup countdowns", error));
}, 1000);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "local" &&
    (changes[STORAGE_TIMED_ACCESS_SITES_KEY] ||
      changes[STORAGE_TIMED_ACCESS_SESSIONS_KEY] ||
      changes[STORAGE_LEISURE_SITES_KEY] ||
      changes[STORAGE_INTERVENTION_LOG_KEY])
  ) {
    getStoredState()
      .then(renderSites)
      .catch((error) => {
        console.error("Failed to refresh timed access countdown", error);
      });
  }
});
