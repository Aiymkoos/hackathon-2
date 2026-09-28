// Камера и MediaPipe Pose Landmarker: кадр → 33 точки тела.
import { FilesetResolver, PoseLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
}

export async function createPoseTracker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const options = delegate => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
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
