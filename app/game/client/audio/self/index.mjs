import { ROUTES } from "../../../../../common/index.mjs";

let audioEl = null;
let muted = false;
let playing = false;
let playlist = [];
let currentTrack = null;
let rafId = null;
let currentVolume = 0;
let initialPlayRefused = false;
let gestureHandled = false;

export function fade(currentTime, duration) {
  if (!Number.isFinite(duration)) return 1;
  if (duration - currentTime >= 10) return 1;
  const f = (duration - currentTime) / 10;
  return f < 0 ? 0 : f;
}

export function next(list, current, rand) {
  if (list.length <= 1) return list[0];
  const others = list.filter((t) => t !== current);
  const idx = Math.floor(rand * (list.length - 1));
  return others[idx];
}

export function state() {
  return {
    track: currentTrack,
    playing,
    muted,
    volume: currentVolume,
  };
}

export function init({ canvas }) {
  const button = document.createElement("button");
  button.style.border = "none";
  button.style.background = "transparent";
  button.style.position = "absolute";
  button.style.left = "12px";
  button.style.bottom = "12px";

  const img = document.createElement("img");
  img.width = 40;
  img.height = 40;
  img.src = ROUTES.assets + "ui/unmute.png";
  button.appendChild(img);

  const parent = canvas.parentElement || document.body;
  parent.appendChild(button);

  function updateImg() {
    img.src = muted ? ROUTES.assets + "ui/mute.png" : ROUTES.assets + "ui/unmute.png";
  }

  button.addEventListener("click", () => {
    muted = !muted;
    if (audioEl) audioEl.muted = muted;
    updateImg();
  });

  fetch(ROUTES.music)
    .then((r) => r.json())
    .then((list) => {
      playlist = list;
      startMusic();
    })
    .catch((e) => {
      console.error(e);
    });

  audioEl = document.createElement("audio");

  function frame() {
    if (audioEl) {
      currentVolume = fade(audioEl.currentTime, audioEl.duration);
      audioEl.volume = muted ? 0 : currentVolume;
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  audioEl.addEventListener("ended", () => {
    playing = false;
    setTimeout(() => {
      if (playlist.length > 0) {
        currentTrack = next(playlist, currentTrack, Math.random());
        loadAndPlay(currentTrack);
      }
    }, 1500);
  });

  function startMusic() {
    if (playlist.length > 0) {
      const idx = Math.floor(Math.random() * playlist.length);
      currentTrack = playlist[idx];
      loadAndPlay(currentTrack);
    }
  }

  function startOnGesture() {
    if (gestureHandled) return;
    if (!initialPlayRefused) return;
    gestureHandled = true;
    startMusic();
  }
  document.addEventListener("pointerdown", startOnGesture, true);
  document.addEventListener("keydown", startOnGesture, true);
  document.addEventListener("touchstart", startOnGesture, true);
}

function loadAndPlay(url) {
  audioEl.src = url;
  audioEl.muted = muted;
  playing = false;
  audioEl.play().then(() => {
    playing = true;
  }).catch((e) => {
    if (e && e.name === "NotAllowedError") {
      initialPlayRefused = true;
    }
  });
}
