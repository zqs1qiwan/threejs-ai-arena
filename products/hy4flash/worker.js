// Model benchmark gallery worker. Each model gets its own work at /<slug>/.
const WORKS = [
  {
    slug: 'deepseekv4.1flash',
    model: 'DeepSeek V4.1 Flash',
    title: '四季 · SHIKI BONSAI',
    desc: '纯代码实时渲染的四时盆景世界：季节流转、风与相机物理、近景细节。',
    tags: ['纯代码', 'Three.js', '四季', '实时'],
    accent: '#8fd25a',
    glyph: '季',
    status: '可体验',
    path: '/deepseekv4.1flash/',
  },
  {
    slug: 'hy4flash',
    model: 'Hy4 Flash',
    title: '禅 · ZEN SHIKI',
    desc: '程序化生成的枯山水盆景：四时流转、锦鲤游弋、耙纹沙庭、石灯笼与鸟居。',
    tags: ['纯代码', 'Three.js', '四季', '枯山水'],
    accent: '#a9d96f',
    glyph: '禅',
    status: '可体验',
    path: '/hy4flash/',
  },
];

const WORK_ROOTS = WORKS.map((w) => w.path.replace(/\/$/, ''));

function landingHTML() {
  const cards = WORKS.map((w) => `
    <a class="card" href="${w.path}" style="--accent:${w.accent}">
      <div class="thumb">
        <span class="glyph">${w.glyph}</span>
        <span class="status">${w.status}</span>
      </div>
      <div class="body">
        <div class="model">${w.model}</div>
        <h2>${w.title}</h2>
        <p>${w.desc}</p>
        <div class="tags">${w.tags.map((t) => `<span>${t}</span>`).join('')}</div>
        <div class="enter">查看作品 <span class="arrow">→</span></div>
      </div>
    </a>`).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>模型作品评测 · MODEL GALLERY</title>
<style>
  :root { --ink:#eef1e6; --muted:#a9b3a1; --line:rgba(230,235,220,.14); --bg:#0b110d; }
  * { box-sizing:border-box; }
  html,body { margin:0; min-height:100%; background:var(--bg); color:var(--ink);
    font-family:"Inter","Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }
  body::before { content:""; position:fixed; inset:0; pointer-events:none;
    background:radial-gradient(1100px 600px at 20% -8%, rgba(143,210,90,.16), transparent 60%),
               radial-gradient(900px 560px at 90% 8%, rgba(120,170,255,.10), transparent 60%),
               radial-gradient(900px 600px at 50% 120%, rgba(255,190,120,.08), transparent 60%); }
  .wrap { position:relative; max-width:1120px; margin:0 auto; padding:clamp(28px,5vw,72px) clamp(20px,4vw,48px) 64px; }
  header { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap;
    border-bottom:1px solid var(--line); padding-bottom:22px; }
  .brand h1 { margin:0; font-family:"Songti SC","Noto Serif SC",Georgia,serif; font-weight:600;
    font-size:clamp(30px,4.6vw,52px); letter-spacing:.04em; }
  .brand h1 em { font-style:normal; font-size:.42em; letter-spacing:.4em; color:var(--muted); margin-left:.7em; }
  .brand p { margin:12px 0 0; color:var(--muted); font-size:clamp(12px,1.2vw,14px); letter-spacing:.04em; max-width:46ch; line-height:1.7; }
  .meta { color:var(--muted); font-size:12px; letter-spacing:.06em; text-align:right; }
  .meta b { display:block; color:var(--ink); font-size:22px; font-family:"Songti SC",Georgia,serif; font-weight:600; margin-bottom:4px; }
  .grid { display:flex; flex-wrap:wrap; justify-content:center; gap:24px;
    max-width:900px; margin:34px auto 0; }
  .card { display:flex; flex-direction:column; text-decoration:none; color:inherit; overflow:hidden;
    flex:1 1 320px; max-width:620px;
    border:1px solid var(--line); border-radius:18px; background:rgba(18,26,21,.55);
    transition:transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
  .card:hover { transform:translateY(-4px); border-color:var(--accent); box-shadow:0 20px 50px rgba(0,0,0,.45); }
  .thumb { position:relative; aspect-ratio:16/9; display:grid; place-items:center; overflow:hidden;
    background:
      radial-gradient(120% 120% at 20% 15%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 60%),
      linear-gradient(140deg, rgba(255,255,255,.06), rgba(0,0,0,.25)),
      repeating-linear-gradient(115deg, rgba(255,255,255,.04) 0 2px, transparent 2px 10px); }
  .thumb .glyph { font-family:"Songti SC",Georgia,serif; font-size:clamp(56px,9vw,104px); color:rgba(255,255,255,.9);
    text-shadow:0 10px 40px rgba(0,0,0,.4); opacity:.92; }
  .thumb .status { position:absolute; top:12px; left:12px; font-size:11px; letter-spacing:.08em;
    padding:4px 9px; border-radius:999px; background:rgba(0,0,0,.42); border:1px solid rgba(255,255,255,.25); color:#e8f0dd; }
  .body { padding:18px 18px 20px; display:flex; flex-direction:column; gap:8px; }
  .model { font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); }
  .body h2 { margin:0; font-family:"Songti SC","Noto Serif SC",Georgia,serif; font-weight:600;
    font-size:clamp(20px,2.2vw,26px); letter-spacing:.03em; }
  .body p { margin:2px 0 4px; color:var(--muted); font-size:13px; line-height:1.65; }
  .tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:2px; }
  .tags span { font-size:11px; color:#d9e2ce; padding:3px 8px; border-radius:999px; border:1px solid var(--line); background:rgba(255,255,255,.03); }
  .enter { margin-top:12px; font-size:13px; color:var(--accent); letter-spacing:.04em; }
  .arrow { display:inline-block; transition:transform .2s ease; }
  .card:hover .arrow { transform:translateX(5px); }
  .soon { flex:1 1 100%; border:1px dashed var(--line); border-radius:14px; padding:16px 18px;
    text-align:center; color:var(--muted); font-size:12.5px; letter-spacing:.06em; background:rgba(255,255,255,.015); }
  .info { display:flex; flex-wrap:wrap; gap:14px; max-width:900px; margin:26px auto 0; }
  .info div { flex:1 1 220px; padding:16px 18px; border:1px solid var(--line); border-radius:14px;
    background:rgba(255,255,255,.02); }
  .info b { display:block; font-family:"Songti SC",Georgia,serif; font-weight:600; font-size:15px; letter-spacing:.05em; margin-bottom:6px; }
  .info span { color:var(--muted); font-size:12px; line-height:1.6; letter-spacing:.03em; }
  footer { margin-top:44px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted);
    font-size:12px; letter-spacing:.03em; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  @media (max-width:520px) { .meta { text-align:left; } .meta b { font-size:18px; } }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">
        <h1>模型作品评测<em>MODEL GALLERY</em></h1>
        <p>同一句话目标，不同模型的实时作品。点击卡片进入对应模型的测试结果，直接体验渲染效果。</p>
      </div>
      <div class="meta"><b>${WORKS.length}</b> 个作品 · 持续更新</div>
    </header>
    <main class="grid">
      ${cards}
      <div class="soon">更多模型作品即将加入 · 每个模型一个独立作品，点击卡片即可体验</div>
    </main>
    <section class="info">
      <div><b>同一目标</b><span>所有模型跑同一句 goal，自主循环打磨到最佳。</span></div>
      <div><b>纯代码实时</b><span>不使用外部模型/贴图，全部程序化生成、可交互实时渲染。</span></div>
      <div><b>直接体验</b><span>点击作品卡片即可进入对应模型的实时测试结果。</span></div>
    </section>
    <footer>
      <span>pure-code interactive benchmark · 纯代码交互评测</span>
      <span>fancy.laobaitv.net</span>
    </footer>
  </div>
</body>
</html>`;
}

async function serveIndex(request, env, prefix) {
  if (prefix) {
    const p = new URL(prefix + '/index.html', request.url).toString();
    const r = await env.ASSETS.fetch(new Request(p, { method: 'GET', headers: request.headers }));
    if (r.status !== 404) return r;
  }
  const indexUrl = new URL('/index.html', request.url).toString();
  return env.ASSETS.fetch(new Request(indexUrl, { method: 'GET', headers: request.headers }));
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);

    if (u.pathname === '/') {
      return new Response(landingHTML(), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    for (const root of WORK_ROOTS) {
      if (u.pathname === root) {
        return Response.redirect(u.origin + root + '/', 302);
      }
      if (u.pathname.startsWith(root + '/')) {
        try {
          let res = await env.ASSETS.fetch(new Request(u.toString(), { method: 'GET', headers: request.headers }));
          if (res.status !== 404) return res;
          const subPath = u.pathname.slice(root.length) || '/';
          const assetUrl = new URL(request.url);
          assetUrl.pathname = subPath;
          res = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET', headers: request.headers }));
          if (res.status === 404) res = await serveIndex(request, env, root);
          return res;
        } catch (e) {
          return await serveIndex(request, env, root);
        }
      }
    }

    try {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404) return await serveIndex(request, env);
      return res;
    } catch (e) {
      return await serveIndex(request, env);
    }
  },
};
