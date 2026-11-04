/**
 * 启动引导。
 *
 * 首屏只加载 index.html 和这个小文件，所以点开就能看到启动页，不用干等。
 * 用户点「开始游戏」之后，才动态 import 游戏本体（Phaser 那一坨 1.5MB）。
 */

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn') as HTMLButtonElement | null;
const startLabel = document.getElementById('start-label');

function setLoading(): void {
  startScreen?.classList.add('loading');
  if (startBtn) startBtn.disabled = true;
  if (startLabel) startLabel.textContent = '加载中…';
}

function setFailed(message: string): void {
  startScreen?.classList.remove('loading');
  if (startBtn) startBtn.disabled = false;
  if (startLabel) startLabel.textContent = message;
}

// 出问题时把信息显示在启动页上，不要留一个黑屏让玩家猜
window.addEventListener('error', (event) => {
  console.error('[boot] 运行时错误', event.error ?? event.message);
  if (startScreen && !startScreen.classList.contains('hidden')) {
    setFailed('游戏出错了，刷新试试');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[boot] 未处理的 Promise 错误', event.reason);
  if (startScreen && !startScreen.classList.contains('hidden')) {
    setFailed('加载失败，刷新试试');
  }
});

async function start(): Promise<void> {
  setLoading();

  // 用 setTimeout 而不是 requestAnimationFrame：
  // rAF 在后台标签页 / iframe 里可能不触发，await 会永远卡住导致游戏起不来。
  await new Promise<void>((resolve) => window.setTimeout(resolve, 60));

  try {
    // 动态导入：游戏代码和资源到这一刻才真正下载
    await import('./main');
  } catch (err) {
    console.error('[boot] 游戏加载失败', err);
    setFailed('加载失败，点我重试');
  }
}

// ---------------- 设置面板 ----------------

const settingsPanel = document.getElementById('settings-panel');
const padSlider = document.getElementById('pad-size') as HTMLInputElement | null;
const padValue = document.getElementById('pad-size-value');
const settingsClose = document.getElementById('settings-close');

const PAD_KEY = 'litu-pad-scale';

const savedScale = Number(window.localStorage.getItem(PAD_KEY));
const initialScale = Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1;

if (padSlider) padSlider.value = String(Math.round(initialScale * 100));
if (padValue) padValue.textContent = `${Math.round(initialScale * 100)}%`;

padSlider?.addEventListener('input', () => {
  const scale = Number(padSlider.value) / 100;
  window.localStorage.setItem(PAD_KEY, String(scale));
  if (padValue) padValue.textContent = `${padSlider.value}%`;
  window.dispatchEvent(new CustomEvent<number>('litu-pad-scale', { detail: scale }));
});

settingsClose?.addEventListener('click', () => {
  settingsPanel?.classList.remove('show');
});

settingsPanel?.addEventListener('click', (event) => {
  if (event.target === settingsPanel) settingsPanel.classList.remove('show');
});

startBtn?.addEventListener('click', () => {
  void start();
});

// 调试用：?autostart=1 跳过启动页直接进游戏
if (new URLSearchParams(window.location.search).get('autostart') === '1') {
  void start();
}

// 场景创建完成后淡出启动页
window.addEventListener(
  'game-ready',
  () => {
    if (!startScreen) return;
    startScreen.classList.add('hidden');
    window.setTimeout(() => startScreen.remove(), 400);
  },
  { once: true },
);
