import { SEASON_NAMES, SEASON_NAMES_EN } from '../core/seasons.js';

// Adaptive UI: season pills, progress, transport, camera controls.
export function mountUI(app, root) {
  root.innerHTML = `
    <header class="title-bar">
      <div class="title">
        <span class="title-main">四季盆景</span>
        <span class="title-sub">Seasonal Bonsai · 纯代码实时生成</span>
      </div>
      <div class="fps" id="fps" title="帧率">-- fps</div>
    </header>

    <div class="season-dock" role="group" aria-label="选择季节">
      ${SEASON_NAMES.map((n, i) => `
        <button class="season-pill" data-season="${i}" aria-pressed="false" title="${SEASON_NAMES_EN[i]}">
          <span class="pill-glyph">${n}</span><span class="pill-label">${SEASON_NAMES_EN[i]}</span>
        </button>`).join('')}
    </div>

    <div class="progress-wrap" aria-label="季节进度">
      <div class="progress-track"><div class="progress-fill" id="progress"></div></div>
      <div class="progress-label" id="season-label">春 · Spring</div>
    </div>

    <div class="controls" role="group" aria-label="控制">
      <button class="icon-btn" id="play" title="播放/暂停 (空格)" aria-label="播放暂停">⏸</button>
      <label class="speed" title="演化速度">
        <span>速度</span>
        <input id="speed" type="range" min="0" max="3" step="0.05" value="1" aria-label="演化速度" />
        <span id="speed-val">1.0×</span>
      </label>
      <button class="icon-btn" id="rotate" title="自动环绕 (A)" aria-label="自动环绕" aria-pressed="true">↻</button>
      <button class="icon-btn" id="reset" title="重置视角 (R)" aria-label="重置视角">⌖</button>
    </div>

    <p class="hint" id="hint">拖拽环绕 · 滚轮/双指缩放 · 点击盆景互动 · 1-4 切换季节</p>
  `;

  const $ = (id) => root.querySelector('#' + id);
  const pills = [...root.querySelectorAll('.season-pill')];

  // accent color from season
  const setAccent = (i) => {
    const accent = ['#e8a7b8', '#8fd18f', '#e0935a', '#a9c4e8'][i];
    document.documentElement.style.setProperty('--accent', accent);
  };

  pills.forEach((btn) => {
    btn.addEventListener('click', () => app.seasonClock.goToSeason(Number(btn.dataset.season)));
  });

  $('play').addEventListener('click', () => app.seasonClock.togglePlaying());
  $('rotate').addEventListener('click', () => {
    app.controls.autoRotate = !app.controls.autoRotate;
    $('rotate').setAttribute('aria-pressed', String(app.controls.autoRotate));
  });
  $('reset').addEventListener('click', () => app.resetCamera());
  const speed = $('speed');
  speed.addEventListener('input', () => { app.seasonClock.setSpeed(Number(speed.value)); $('speed-val').textContent = Number(speed.value).toFixed(2) + '×'; });

  // reflect clock state
  const clock = app.seasonClock;
  const render = () => {
    const idx = clock.index;
    pills.forEach((b, i) => b.setAttribute('aria-pressed', String(i === idx)));
    setAccent(idx);
    $('season-label').textContent = `${SEASON_NAMES[idx]} · ${SEASON_NAMES_EN[idx]}`;
    $('progress').style.width = (clock.phase * 100).toFixed(1) + '%';
    $('play').textContent = clock.playing ? '⏸' : '▶';
    $('play').setAttribute('aria-label', clock.playing ? '暂停' : '播放');
  };
  clock.on(render);

  // per-frame light update of progress + fps
  let raf;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (clock) { $('progress').style.width = (clock.phase * 100).toFixed(1) + '%'; }
    const info = window.appInfo;
    if (info) { $('fps').textContent = (info.fps ?? '--') + ' fps'; }
  };
  raf = requestAnimationFrame(tick);

  render();

  // fade hint
  setTimeout(() => { const h = $('hint'); if (h) h.classList.add('fade'); }, 6000);

  return { render };
}
