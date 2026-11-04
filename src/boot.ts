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

async function start(): Promise<void> {
  setLoading();

  // 等两帧，确保 #game 已经完成布局，否则 Phaser 会按错误尺寸创建画布
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    // 动态导入：游戏代码和资源到这一刻才真正下载
    await import('./main');
  } catch (err) {
    console.error('[boot] 游戏加载失败', err);
    setFailed('加载失败，点我重试');
  }
}

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
