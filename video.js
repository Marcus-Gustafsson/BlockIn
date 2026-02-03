// video.js

/**
 * Save the selected video path in extension storage for later debugging.
 * @param {string} selectedVideoPath - The video path to store.
 * @returns {Promise<void>} Resolves when the path is saved.
 */
function storeSelectedVideoPath(selectedVideoPath) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ selectedVideo: selectedVideoPath }, () => {
      resolve();
    });
  });
}

/**
 * Pick a random video and set it on the video player.
 * @returns {Promise<void>} Resolves after the video source is set.
 */
async function initializeVideoPlayer() {
  console.log("Document loaded");

  const videoPlayer = document.getElementById("videoPlayer");

  if (!videoPlayer) {
    console.error("Video player element not found.");
    return;
  }

  try {
    // Get a random video from the videos folder.
    const randomVideoPath = await getRandomVideoPath();

    if (!randomVideoPath) {
      console.error("No videos were found in the videos folder.");
      return;
    }

    // Convert the stored path to a full extension URL.
    const videoUrl = chrome.runtime.getURL(randomVideoPath);
    console.log("Setting video source to:", videoUrl);
    videoPlayer.src = videoUrl;

    // Store the selection so it is visible in chrome.storage for debugging.
    await storeSelectedVideoPath(randomVideoPath);
  } catch (error) {
    console.error("Failed to select a random video:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeVideoPlayer();
});
  
  
  
  
  
  
