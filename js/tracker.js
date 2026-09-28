// Камера и MediaPipe Pose Landmarker: кадр → 33 точки тела.
// Движок и модель лежат в репозитории (vendor/, models/) и скачиваются заранее (loader.js).
import { PoseLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
}

/** assets — результат preload(): { fileset, model }. */
export async function createPoseTracker({ fileset, model }) {
  const options = delegate => ({
    baseOptions: { modelAssetBuffer: model, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let landmarker;
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    landmarker = await PoseLandmarker.createFromOptions(fileset, options('CPU'));
  }

  let lastVideoTime = -1;
  return {
    // Возвращает null, если нового кадра с камеры ещё нет.
    detect(video, now) {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return null;
      lastVideoTime = video.currentTime;
      return landmarker.detectForVideo(video, now);
    },
  };
}
