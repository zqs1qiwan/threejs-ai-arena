import { App } from './world/App.js';
import { mountUI } from './ui/UI.js';

const canvas = document.getElementById('scene-canvas');

// graceful WebGL error surface
let app;
try {
  app = new App(canvas);
  app.start();
  mountUI(app, document.getElementById('app'));
  window.__app = app;
} catch (err) {
  console.error('[season-bonsai] failed to start', err);
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = `<div class="fatal"><h2>场景初始化失败</h2><p>${(err && err.message) || err}</p><p>请使用支持 WebGL2 的现代浏览器。</p></div>`;
  }
}
