const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

/**
 * Check if a filename looks like a supported video file.
 * @param {string} fileName - The filename to check.
 * @returns {boolean} True when the filename has a known video extension.
 */
function isSupportedVideoFile(fileName) {
  const lowerCaseFileName = fileName.toLowerCase();
  return SUPPORTED_VIDEO_EXTENSIONS.some((extension) =>
    lowerCaseFileName.endsWith(extension)
  );
}

/**
 * Read all file entries from the extension's videos directory.
 * @returns {Promise<string[]>} A promise that resolves with video paths for the extension.
 */
function getAvailableVideoPaths() {
  return new Promise((resolve, reject) => {
    if (typeof chrome.runtime.getPackageDirectoryEntry !== "function") {
      reject(
        new Error(
          "Directory access is not available in this context. The videos folder can only be read from extension pages."
        )
      );
      return;
    }

    chrome.runtime.getPackageDirectoryEntry((rootDirectoryEntry) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      // Find the "videos" folder that ships with the extension.
      rootDirectoryEntry.getDirectory(
        "videos",
        {},
        (videosDirectoryEntry) => {
          const directoryReader = videosDirectoryEntry.createReader();
          const collectedEntries = [];

          const readNextBatch = () => {
            // Read entries in batches until no more are returned.
            directoryReader.readEntries((entries) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }

              if (entries.length === 0) {
                // Filter out non-video files and build extension-relative paths.
                const videoPaths = collectedEntries
                  .filter(
                    (entry) => entry.isFile && isSupportedVideoFile(entry.name)
                  )
                  .map((entry) => `videos/${entry.name}`);
                resolve(videoPaths);
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

/**
 * Pick a random video path from the videos folder.
 * @returns {Promise<string | null>} A random video path, or null when none are found.
 */
async function getRandomVideoPath() {
  const availableVideoPaths = await getAvailableVideoPaths();

  if (availableVideoPaths.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(
    Math.random() * availableVideoPaths.length
  );
  return availableVideoPaths[randomIndex];
}
  
  
  
  
