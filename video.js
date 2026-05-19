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
 * Show a visible fallback message on the redirected page.
 * @param {string} message - The message to show.
 * @returns {void}
 */
function showVideoMessage(message) {
  const videoMessage = document.getElementById("videoMessage");

  if (!videoMessage) {
    return;
  }

  videoMessage.textContent = message;
  videoMessage.classList.add("visible");
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
    showVideoMessage("Video player could not be loaded.");
    return;
  }

  videoPlayer.addEventListener("error", () => {
    console.error("Selected video failed to load.");
    showVideoMessage("Selected video could not be loaded. Check the videos folder and reload the extension.");
  });

  try {
    // Get a random video from the videos folder.
    const randomVideoPath = await getRandomVideoPath();

    if (!randomVideoPath) {
      console.error("No videos were found in the videos folder.");
      showVideoMessage("No supported videos found. Add .mp4, .webm, .mov, or .m4v files to the videos folder and reload the extension.");
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
    showVideoMessage("Could not read the videos folder. Reload the extension and check the page console for details.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeVideoPlayer();
});
