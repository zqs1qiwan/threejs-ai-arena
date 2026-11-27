import { SEASONS, clonePalette, mixPaletteInto } from './seasons.js';

// Drives the four-season cycle. `phase` is 0..1 progress inside current season.
// The lerped `current` palette blends current season -> next across `transitionWindow`.
export class SeasonClock {
  constructor() {
    this.index = 0;              // current season 0..3
    this.phase = 0;              // 0..1 inside season
    this.speed = 1.0;            // 1 = base
    this.playing = true;
    this.duration = 24;          // seconds per season at speed 1
    this.transitionWindow = 0.55; // fraction of season used to blend into next
    this.current = clonePalette(SEASONS[0]);
    this._listeners = [];
    this._holdIndex = null;      // when user manually selects a season
  }

  on(fn) { this._listeners.push(fn); return () => { const i = this._listeners.indexOf(fn); if (i >= 0) this._listeners.splice(i, 1); }; }
  emit(ev) { for (const fn of this._listeners) fn(ev, this); }

  get season() { return SEASONS[this.index]; }
  get next() { return SEASONS[(this.index + 1) % 4]; }

  setSpeed(v) { this.speed = Math.max(0, Math.min(4, v)); this.emit('speed'); }
  setPlaying(v) { this.playing = !!v; this.emit('playing'); }
  togglePlaying() { this.setPlaying(!this.playing); }

  // Manually jump to a season; smooth blend handled by holding phase at 0.
  goToSeason(i, { smooth = true } = {}) {
    i = ((i % 4) + 4) % 4;
    this.index = i;
    this.phase = 0;
    this._holdIndex = smooth ? null : i;
    this._recompute();
    this.emit('season', { index: i });
  }

  update(dt) {
    if (this.playing && this.speed > 0) {
      this.phase += (dt * this.speed) / this.duration;
      while (this.phase >= 1) {
        this.phase -= 1;
        this.index = (this.index + 1) % 4;
        this.emit('season', { index: this.index });
      }
    }
    this._recompute();
  }

  _recompute() {
    const a = SEASONS[this.index];
    const b = SEASONS[(this.index + 1) % 4];
    // blend factor: only start transitioning near end of season
    const tw = this.transitionWindow;
    let t = 0;
    if (this.phase > 1 - tw) t = (this.phase - (1 - tw)) / tw;
    t = Math.max(0, Math.min(1, t));
    // smoothstep
    t = t * t * (3 - 2 * t);
    mixPaletteInto(this.current, a, b, t);
  }

  // 0..1 progress to show in UI
  get displayProgress() { return this.phase; }
}
