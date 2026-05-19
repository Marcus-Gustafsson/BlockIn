// background.js

importScripts("blocked-sites.js");

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
      urlFilter: site.urlFilter,
      resourceTypes: site.resourceTypes || ["main_frame"]
    }
  };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: BLOCKED_SITES.map((site) => site.id),
    addRules: BLOCKED_SITES.map(buildRedirectRule)
  });
  console.log("Dynamic rules updated");
});
