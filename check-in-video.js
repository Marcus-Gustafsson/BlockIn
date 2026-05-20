const CHECK_IN_VIDEO_FOLDER = "check-in-videos";
const SUPPORTED_CHECK_IN_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

function notifyParent(hasVideo) {
  window.parent.postMessage(
    {
      source: "blockin-check-in-video",
      hasVideo
    },
    "*"
  );
}

function isSupportedCheckInVideoFile(fileName) {
  const lowerCaseFileName = fileName.toLowerCase();
  return SUPPORTED_CHECK_IN_VIDEO_EXTENSIONS.some((extension) =>
    lowerCaseFileName.endsWith(extension)
  );
}

function getAvailableCheckInVideoPaths() {
  return new Promise((resolve, reject) => {
    if (typeof chrome.runtime.getPackageDirectoryEntry !== "function") {
      reject(
        new Error(
          "Directory access is not available in this context."
        )
      );
      return;
    }

    chrome.runtime.getPackageDirectoryEntry((rootDirectoryEntry) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      rootDirectoryEntry.getDirectory(
        CHECK_IN_VIDEO_FOLDER,
        {},
        (checkInDirectoryEntry) => {
          const directoryReader = checkInDirectoryEntry.createReader();
          const collectedEntries = [];

          const readNextBatch = () => {
            directoryReader.readEntries((entries) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }

              if (entries.length === 0) {
                resolve(
                  collectedEntries
                    .filter(
                      (entry) =>
                        entry.isFile && isSupportedCheckInVideoFile(entry.name)
                    )
                    .map((entry) => `${CHECK_IN_VIDEO_FOLDER}/${entry.name}`)
                );
                return;
              }

              collectedEntries.push(...entries);
              readNextBatch();
            }, reject);
          };

          readNextBatch();
        },
        reject
      );
    });
  });
}

async function initializeCheckInVideoPlayer() {
  const videoPlayer = document.getElementById("checkInVideoPlayer");
  if (!videoPlayer) {
    notifyParent(false);
    return;
  }

  try {
    const availableVideoPaths = await getAvailableCheckInVideoPaths();
    if (availableVideoPaths.length === 0) {
      notifyParent(false);
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableVideoPaths.length);
    const selectedVideoPath = availableVideoPaths[randomIndex];
    videoPlayer.src = chrome.runtime.getURL(selectedVideoPath);
    videoPlayer.classList.add("visible");
    notifyParent(true);
  } catch (error) {
    console.error("Failed to load check-in video:", error);
    notifyParent(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeCheckInVideoPlayer();
});
