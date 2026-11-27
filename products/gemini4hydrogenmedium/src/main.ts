import './style.css';
import { BonsaiExperience, CameraPresetKey } from './scene/BonsaiExperience';
import { LightingMood } from './utils/seasonState';

const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement;
const seasonSubtitle = document.getElementById('season-subtitle') as HTMLElement;
const seasonSlider = document.getElementById('season-slider') as HTMLInputElement;
const playBtn = document.getElementById('btn-play') as HTMLButtonElement;
const playIcon = document.getElementById('play-icon') as HTMLElement;
const gustBtn = document.getElementById('btn-gust') as HTMLButtonElement;
const windSlider = document.getElementById('wind-slider') as HTMLInputElement;
const windVal = document.getElementById('wind-val') as HTMLElement;
const hudDock = document.getElementById('hud-dock') as HTMLElement;
const hudToggle = document.getElementById('btn-hud-toggle') as HTMLButtonElement;
const hintToast = document.getElementById('hint-toast') as HTMLElement;

const seasonBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.season-btn'));
const camBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#camera-presets .chip'));
const moodBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#mood-presets .chip'));

let isPlaying = true;
let isSliderDragging = false;

const experience = new BonsaiExperience(canvas, {
  onSeasonUpdate: (season, palette) => {
    if (!isSliderDragging) {
      seasonSlider.value = season.toFixed(3);
    }
    if (seasonSubtitle.textContent !== palette.subtitle) {
      seasonSubtitle.textContent = palette.subtitle;
    }
    document.documentElement.style.setProperty('--accent', palette.uiAccent);

    // Highlight nearest season pill
    const nearest = Math.round(season) % 4;
    seasonBtns.forEach((btn, i) => {
      btn.classList.toggle('active', i === nearest);
    });
  },
});

// Season Pill Clicks
seasonBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const s = Number(btn.dataset.season ?? 0);
    experience.setSeason(s, true);
  });
});

// Timeline Scrubber
seasonSlider.addEventListener('pointerdown', () => {
  isSliderDragging = true;
});
seasonSlider.addEventListener('input', () => {
  const val = parseFloat(seasonSlider.value);
  experience.setSeason(val, false);
});
window.addEventListener('pointerup', () => {
  isSliderDragging = false;
});

// Play / Pause Auto Cycle
const togglePlay = () => {
  isPlaying = !isPlaying;
  experience.setAutoPlay(isPlaying);
  playIcon.textContent = isPlaying ? '❚❚' : '▶';
};
playBtn.addEventListener('click', togglePlay);

// Wind & Gust
gustBtn.addEventListener('click', () => {
  experience.triggerGust();
});

windSlider.addEventListener('input', () => {
  const w = parseFloat(windSlider.value);
  windVal.textContent = w.toFixed(2);
  experience.setWind(w);
});

// Camera Presets
camBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.cam as CameraPresetKey;
    camBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    experience.setCameraPreset(key);
  });
});

// Mood Presets
moodBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mood = btn.dataset.mood as LightingMood;
    moodBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    experience.setMood(mood);
  });
});

// Mobile HUD Drawer Toggle
hudToggle.addEventListener('click', () => {
  hudDock.classList.toggle('collapsed');
});

// Auto-fade hint toast after 8s
setTimeout(() => {
  hintToast?.classList.add('hidden');
}, 8000);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === '1') {
    experience.setSeason(0, true);
  } else if (e.key === '2') {
    experience.setSeason(1, true);
  } else if (e.key === '3') {
    experience.setSeason(2, true);
  } else if (e.key === '4') {
    experience.setSeason(3, true);
  } else if (e.key.toLowerCase() === 'g') {
    experience.triggerGust();
  } else if (e.key.toLowerCase() === 'r') {
    experience.setCameraPreset('overview');
    camBtns.forEach((b) => b.classList.toggle('active', b.dataset.cam === 'overview'));
  }
});

// Expose lightweight debug handle for automated visual inspection
(window as unknown as Record<string, unknown>).__shikiEn = experience;
