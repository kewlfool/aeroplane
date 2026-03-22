let liveLayer;
let frozenPatches = [];

let cameraVideo = null;
let cameraStream = null;
let cameraStatus = "starting";
let cameraMessage = "Requesting camera access...";
let activeCameraFacingMode = "environment";
let cameraToggleButton = null;

const MIN_SELECTION_SIZE = 12;
const SINGLE_TAP_MAX_DISTANCE = 16;
const SINGLE_TAP_MAX_DURATION = 220;
const TRIPLE_TAP_MAX_INTERVAL = 320;
const TRIPLE_TAP_MAX_SPREAD = 48;
const TWO_FINGER_TAP_MAX_DISTANCE = 24;
const TWO_FINGER_TAP_MAX_DURATION = 260;
const TWO_FINGER_HOLD_DURATION = 650;

let dragState = {
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  startedAt: 0,
};

let suppressMouseUntil = 0;
let multiTouchGesture = createIdleMultiTouchGesture();
let tapSequence = createIdleTapSequence();

function setup() {
  pixelDensity(1);

  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.style("display", "block");
  canvas.style("touch-action", "none");

  liveLayer = createGraphics(windowWidth, windowHeight);
  liveLayer.pixelDensity(1);

  configureViewport();
  createHiddenVideoElement();
  createCameraToggleButton();
  startCamera();
}

function draw() {
  background(0);

  if (multiTouchGesture.active) {
    updateMultiTouchGesture();
  }

  drawLiveCamera();
  image(liveLayer, 0, 0, width, height);
  drawFrozenPatches();

  if (dragState.active) {
    drawSelectionPreview();
  }

  if (cameraStatus !== "ready") {
    drawStatusOverlay();
  }
}

function configureViewport() {
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.documentElement.style.margin = "0";
  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.background = "#000";
}

function createHiddenVideoElement() {
  const videoElement = createElement("video");
  videoElement.hide();

  cameraVideo = videoElement.elt;
  cameraVideo.autoplay = true;
  cameraVideo.muted = true;
  cameraVideo.playsInline = true;
  cameraVideo.setAttribute("autoplay", "");
  cameraVideo.setAttribute("muted", "");
  cameraVideo.setAttribute("playsinline", "");
  cameraVideo.setAttribute("webkit-playsinline", "");

  cameraVideo.onloadedmetadata = () => {
    attemptVideoPlayback();
  };
}

function createCameraToggleButton() {
  cameraToggleButton = createButton("");
  cameraToggleButton.attribute("type", "button");
  cameraToggleButton.mousePressed(toggleCameraFacingMode);
  cameraToggleButton.style("position", "fixed");
  cameraToggleButton.style("bottom", "20px");
  cameraToggleButton.style("right", "20px");
  cameraToggleButton.style("z-index", "20");
  cameraToggleButton.style("width", "56px");
  cameraToggleButton.style("height", "56px");
  cameraToggleButton.style("padding", "0");
  cameraToggleButton.style("border", "0");
  cameraToggleButton.style("border-radius", "50%");
  cameraToggleButton.style("background", "rgba(0, 0, 0, 0.68)");
  cameraToggleButton.style("color", "#ffffff");
  cameraToggleButton.style("display", "flex");
  cameraToggleButton.style("align-items", "center");
  cameraToggleButton.style("justify-content", "center");
  cameraToggleButton.style("touch-action", "manipulation");
  cameraToggleButton.style("cursor", "pointer");
  updateCameraToggleButton();
}

function updateCameraToggleButton() {
  if (!cameraToggleButton) {
    return;
  }

  const nextFacingMode =
    activeCameraFacingMode === "environment" ? "Front Camera" : "Back Camera";

  cameraToggleButton.attribute("aria-label", `Switch to ${nextFacingMode}`);
  cameraToggleButton.attribute("title", `Switch to ${nextFacingMode}`);
  cameraToggleButton.html(
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5L6 8L9 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M15 13L18 16L15 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 8H14C16.761 8 19 10.239 19 13V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M18 16H10C7.239 16 5 13.761 5 11V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
  );
}

async function startCamera(targetFacingMode = activeCameraFacingMode) {
  if (!window.isSecureContext) {
    cameraStatus = "error";
    cameraMessage = "Open this app from localhost or https. file:// cannot use the camera.";
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus = "error";
    cameraMessage = "This browser does not support camera access.";
    return;
  }

  cameraStatus = "starting";
  cameraMessage = "Requesting camera access...";
  if (cameraToggleButton) {
    cameraToggleButton.attribute("disabled", "");
    cameraToggleButton.style("opacity", "0.6");
  }

  try {
    const previousStream = cameraStream;
    const nextStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: targetFacingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    cameraStream = nextStream;
    activeCameraFacingMode = targetFacingMode;
    cameraVideo.srcObject = cameraStream;
    updateCameraToggleButton();
    attemptVideoPlayback();

    if (previousStream && previousStream !== nextStream) {
      for (const track of previousStream.getTracks()) {
        track.stop();
      }
    }
  } catch (error) {
    cameraStatus = "error";
    cameraMessage = describeCameraError(error);
  } finally {
    if (cameraToggleButton) {
      cameraToggleButton.removeAttribute("disabled");
      cameraToggleButton.style("opacity", "1");
    }
  }
}

function stopCamera() {
  if (!cameraStream) {
    return;
  }

  for (const track of cameraStream.getTracks()) {
    track.stop();
  }

  cameraStream = null;
}

async function attemptVideoPlayback() {
  if (!cameraVideo || !cameraVideo.srcObject) {
    return;
  }

  try {
    await cameraVideo.play();
    cameraStatus = "ready";
    cameraMessage = "";
  } catch (error) {
    cameraStatus = "starting";
    cameraMessage = "Tap once if Safari needs a gesture to start the camera.";
  }
}

function drawLiveCamera() {
  liveLayer.background(0);

  if (!isCameraFrameReady()) {
    return;
  }

  const sourceWidth = cameraVideo.videoWidth;
  const sourceHeight = cameraVideo.videoHeight;
  const targetWidth = width;
  const targetHeight = height;

  const crop = getCoverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight);
  liveLayer.drawingContext.save();

  if (activeCameraFacingMode === "user") {
    liveLayer.drawingContext.translate(targetWidth, 0);
    liveLayer.drawingContext.scale(-1, 1);
  }

  liveLayer.drawingContext.drawImage(
    cameraVideo,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    targetWidth,
    targetHeight
  );
  liveLayer.drawingContext.restore();
}

function drawFrozenPatches() {
  for (const patch of frozenPatches) {
    image(patch.img, patch.x, patch.y, patch.w, patch.h);
  }
}

function isCameraFrameReady() {
  return (
    cameraVideo &&
    cameraVideo.readyState >= cameraVideo.HAVE_CURRENT_DATA &&
    cameraVideo.videoWidth > 0 &&
    cameraVideo.videoHeight > 0
  );
}

function getCoverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  if (sourceAspect > targetAspect) {
    const sw = sourceHeight * targetAspect;
    return {
      sx: (sourceWidth - sw) * 0.5,
      sy: 0,
      sw,
      sh: sourceHeight,
    };
  }

  const sh = sourceWidth / targetAspect;
  return {
    sx: 0,
    sy: (sourceHeight - sh) * 0.5,
    sw: sourceWidth,
    sh,
  };
}

function drawSelectionPreview() {
  const selection = getSelectionBounds();

  push();
  noFill();
  strokeJoin(ROUND);

  stroke(0, 180);
  strokeWeight(4);
  rect(selection.x, selection.y, selection.w, selection.h, 12);

  stroke(255);
  strokeWeight(2);
  fill(255, 255, 255, 24);
  rect(selection.x, selection.y, selection.w, selection.h, 12);
  pop();
}

function drawStatusOverlay() {
  push();
  rectMode(CORNER);
  noStroke();
  fill(0, 140);
  rect(20, height - 76, width - 40, 56, 14);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(cameraMessage, width * 0.5, height - 48);
  pop();
}

function beginSelection(x, y) {
  if (multiTouchGesture.active) {
    return;
  }

  dragState.active = true;
  dragState.startX = constrain(x, 0, width);
  dragState.startY = constrain(y, 0, height);
  dragState.currentX = dragState.startX;
  dragState.currentY = dragState.startY;
  dragState.startedAt = millis();

  attemptVideoPlayback();
}

function updateSelection(x, y) {
  if (!dragState.active) {
    return;
  }

  dragState.currentX = constrain(x, 0, width);
  dragState.currentY = constrain(y, 0, height);
}

function endSelection(x, y) {
  if (!dragState.active) {
    return;
  }

  updateSelection(x, y);
  const selection = getSelectionBounds();
  const pressDuration = millis() - dragState.startedAt;
  dragState.active = false;

  if (isQuickTap(selection, pressDuration)) {
    registerTap(selection);
    return;
  }

  resetTapSequence();
  freezeSelection(selection);
}

function getSelectionBounds() {
  const x = min(dragState.startX, dragState.currentX);
  const y = min(dragState.startY, dragState.currentY);
  const w = abs(dragState.currentX - dragState.startX);
  const h = abs(dragState.currentY - dragState.startY);

  return { x, y, w, h };
}

function freezeSelection(selection) {
  if (!selection) {
    return;
  }

  if (selection.w < MIN_SELECTION_SIZE || selection.h < MIN_SELECTION_SIZE) {
    return;
  }

  drawLiveCamera();

  if (!isCameraFrameReady()) {
    return;
  }

  const normalized = normalizeSelection(selection);

  if (normalized.w < 1 || normalized.h < 1) {
    return;
  }

  frozenPatches.push({
    img: liveLayer.get(normalized.x, normalized.y, normalized.w, normalized.h),
    x: normalized.x,
    y: normalized.y,
    w: normalized.w,
    h: normalized.h,
    xRatio: normalized.x / width,
    yRatio: normalized.y / height,
    wRatio: normalized.w / width,
    hRatio: normalized.h / height,
  });
}

function normalizeSelection(selection) {
  const x = constrain(floor(selection.x), 0, width);
  const y = constrain(floor(selection.y), 0, height);
  const maxW = width - x;
  const maxH = height - y;
  const w = constrain(ceil(selection.w), 0, maxW);
  const h = constrain(ceil(selection.h), 0, maxH);

  return { x, y, w, h };
}

function undoLastPatch() {
  if (frozenPatches.length === 0) {
    return;
  }

  frozenPatches.pop();
}

function clearFrozenPatches() {
  if (frozenPatches.length === 0) {
    return;
  }

  frozenPatches = [];
}

function cancelSelection() {
  dragState.active = false;
}

function isQuickTap(selection, pressDuration) {
  return (
    selection.w <= SINGLE_TAP_MAX_DISTANCE &&
    selection.h <= SINGLE_TAP_MAX_DISTANCE &&
    pressDuration <= SINGLE_TAP_MAX_DURATION
  );
}

function createIdleTapSequence() {
  return {
    count: 0,
    lastTapAt: 0,
    lastX: 0,
    lastY: 0,
  };
}

function resetTapSequence() {
  tapSequence = createIdleTapSequence();
}

function registerTap(selection) {
  const now = millis();
  const tapX = dragState.startX;
  const tapY = dragState.startY;
  const timeSinceLastTap = now - tapSequence.lastTapAt;
  const distanceFromLastTap = dist(tapX, tapY, tapSequence.lastX, tapSequence.lastY);
  const continuesSequence =
    tapSequence.count > 0 &&
    timeSinceLastTap <= TRIPLE_TAP_MAX_INTERVAL &&
    distanceFromLastTap <= TRIPLE_TAP_MAX_SPREAD;

  if (continuesSequence) {
    tapSequence.count += 1;
  } else {
    tapSequence.count = 1;
  }

  tapSequence.lastTapAt = now;
  tapSequence.lastX = tapX;
  tapSequence.lastY = tapY;

  if (tapSequence.count >= 3) {
    saveCurrentCanvasImage();
    resetTapSequence();
  }
}

function saveCurrentCanvasImage() {
  saveCanvas(`freeze-${Date.now()}`, "png");
}

async function toggleCameraFacingMode() {
  cancelSelection();
  multiTouchGesture = createIdleMultiTouchGesture();
  resetTapSequence();

  const nextFacingMode =
    activeCameraFacingMode === "environment" ? "user" : "environment";

  await startCamera(nextFacingMode);
}

function createIdleMultiTouchGesture() {
  return {
    active: false,
    startedAt: 0,
    startX: 0,
    startY: 0,
    maxDistance: 0,
    holdTriggered: false,
  };
}

function startMultiTouchGesture() {
  const center = getTouchesCenter();

  if (!center) {
    return;
  }

  resetTapSequence();
  cancelSelection();
  multiTouchGesture = {
    active: true,
    startedAt: millis(),
    startX: center.x,
    startY: center.y,
    maxDistance: 0,
    holdTriggered: false,
  };
}

function updateMultiTouchGesture() {
  if (!multiTouchGesture.active) {
    return;
  }

  const center = getTouchesCenter();

  if (!center) {
    return;
  }

  const distanceMoved = dist(
    center.x,
    center.y,
    multiTouchGesture.startX,
    multiTouchGesture.startY
  );

  multiTouchGesture.maxDistance = max(
    multiTouchGesture.maxDistance,
    distanceMoved
  );

  if (
    !multiTouchGesture.holdTriggered &&
    millis() - multiTouchGesture.startedAt >= TWO_FINGER_HOLD_DURATION &&
    multiTouchGesture.maxDistance <= TWO_FINGER_TAP_MAX_DISTANCE
  ) {
    clearFrozenPatches();
    multiTouchGesture.holdTriggered = true;
  }
}

function finishMultiTouchGesture() {
  if (!multiTouchGesture.active) {
    return;
  }

  const duration = millis() - multiTouchGesture.startedAt;
  const shouldUndo =
    !multiTouchGesture.holdTriggered &&
    duration <= TWO_FINGER_TAP_MAX_DURATION &&
    multiTouchGesture.maxDistance <= TWO_FINGER_TAP_MAX_DISTANCE;

  multiTouchGesture = createIdleMultiTouchGesture();

  if (shouldUndo) {
    undoLastPatch();
  }
}

function getTouchesCenter() {
  if (!touches || touches.length < 2) {
    return null;
  }

  return {
    x: (touches[0].x + touches[1].x) * 0.5,
    y: (touches[0].y + touches[1].y) * 0.5,
  };
}

function resizeFrozenPatches(newWidth, newHeight) {
  for (const patch of frozenPatches) {
    patch.x = round(patch.xRatio * newWidth);
    patch.y = round(patch.yRatio * newHeight);
    patch.w = round(patch.wRatio * newWidth);
    patch.h = round(patch.hRatio * newHeight);
  }
}

function touchStarted() {
  suppressMouseUntil = millis() + 400;

  if (touches.length >= 2) {
    startMultiTouchGesture();
    return false;
  }

  beginSelection(mouseX, mouseY);
  return false;
}

function touchMoved() {
  suppressMouseUntil = millis() + 400;

  if (multiTouchGesture.active || touches.length >= 2) {
    updateMultiTouchGesture();
    return false;
  }

  updateSelection(mouseX, mouseY);
  return false;
}

function touchEnded() {
  suppressMouseUntil = millis() + 400;

  if (multiTouchGesture.active) {
    finishMultiTouchGesture();
    return false;
  }

  endSelection(mouseX, mouseY);
  return false;
}

function mousePressed() {
  if (millis() < suppressMouseUntil) {
    return false;
  }

  beginSelection(mouseX, mouseY);
  return false;
}

function mouseDragged() {
  if (millis() < suppressMouseUntil) {
    return false;
  }

  updateSelection(mouseX, mouseY);
  return false;
}

function mouseReleased() {
  if (millis() < suppressMouseUntil) {
    return false;
  }

  endSelection(mouseX, mouseY);
  return false;
}

function keyPressed() {
  if (key === "z" || key === "Z" || keyCode === BACKSPACE || keyCode === DELETE) {
    undoLastPatch();
    return false;
  }

  if (key === "c" || key === "C") {
    clearFrozenPatches();
    return false;
  }
}

function windowResized() {
  const newWidth = windowWidth;
  const newHeight = windowHeight;

  resetTapSequence();
  cancelSelection();
  multiTouchGesture = createIdleMultiTouchGesture();
  resizeCanvas(windowWidth, windowHeight);
  liveLayer.resizeCanvas(windowWidth, windowHeight);
  resizeFrozenPatches(newWidth, newHeight);
}

function describeCameraError(error) {
  if (!error || !error.name) {
    return "Camera start failed.";
  }

  if (error.name === "NotAllowedError") {
    return "Camera access was denied.";
  }

  if (error.name === "NotFoundError") {
    return "No camera was found on this device.";
  }

  if (error.name === "NotReadableError") {
    return "The camera is already in use by another app.";
  }

  return "Camera start failed.";
}
