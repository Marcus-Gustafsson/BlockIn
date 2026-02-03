// background.js

importScripts('videos.js');

function setRandomVideo() {
  const randomVideo = getRandomVideoPath();
  console.log('Random video selected:', randomVideo);
  chrome.storage.local.set({ selectedVideo: randomVideo }, () => {
    console.log('Selected video saved to storage');
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  setRandomVideo();
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [2, 3, 4],
    addRules: [
      {
        id: 2,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            extensionPath: "/video.html"
          }
        },
        condition: {
          urlFilter: "*://*.facebook.com/*",
          resourceTypes: ["main_frame"]
        }
      }
      ,
      {
        id: 3,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            extensionPath: "/video.html"
          }
        },
        condition: {
          urlFilter: "*://*.instagram.com/*",
          resourceTypes: ["main_frame"]
        }
      }
      ,
      {
        id: 4,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            extensionPath: "/video.html"
          }
        },
        condition: {
          urlFilter: "*://*.twitch.tv/*",
          resourceTypes: ["main_frame"]
        }
      }
    ]
  });
  console.log('Dynamic rules updated');
});

chrome.webNavigation.onCommitted.addListener((details) => {
  console.log('onCommitted triggered for URL:', details.url);
  if (details.url.includes('video.html')) {
    setRandomVideo();
  }
});








