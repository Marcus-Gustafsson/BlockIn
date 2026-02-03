// video.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded');
    chrome.storage.local.get('selectedVideo', (data) => {
      console.log('Storage data retrieved:', data);
      const videoPlayer = document.getElementById('videoPlayer');
      if (data.selectedVideo) {
        const videoPath = chrome.runtime.getURL(data.selectedVideo);
        console.log('Setting video source to:', videoPath);
        videoPlayer.src = videoPath;
      } else {
        console.error('No video selected');
      }
    });
  });
  
  
  
  
  
  