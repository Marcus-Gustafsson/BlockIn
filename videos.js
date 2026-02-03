const videoPaths = [
    "videos/video1.webm",
    "videos/video2.webm",
    "videos/video3.mp4",
    "videos/video4.mp4",
    "videos/video5.mp4",
    "videos/video6.mp4",
    "videos/video7.mp4",
    "videos/video8.mp4",
    "videos/video9.mp4",
    "videos/video10.mp4"
  ];
  
  function getRandomVideoPath() {
    const randomIndex = Math.floor(Math.random() * videoPaths.length);
    return videoPaths[randomIndex];
  }
  
  
  
  