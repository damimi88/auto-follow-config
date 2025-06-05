const remoteConfigUrl = "https://raw.githubusercontent.com/damimi88/auto-follow-config/main/config.json";

// ======= 初始化变量 =======
let blockedNameKeywords = [];
let blockedGeneralKeywords = [];
let targetNameKeywords = [];
let targetGeneralKeywords = [];

let isPaused = true;
let isReady = false; // 标记是否已加载远程关键词配置

async function fetchRemoteConfig() {
  try {
    const res = await fetch(remoteConfigUrl);
    const cfg = await res.json();

    blockedNameKeywords = cfg.blockedNameKeywords || [];
    blockedGeneralKeywords = cfg.blockedGeneralKeywords || [];
    targetNameKeywords = cfg.targetNameKeywords || [];
    targetGeneralKeywords = cfg.targetGeneralKeywords || [];

    isPaused = !!cfg.paused;
    console.log("✅ 已同步远程关键词配置");
  } catch (e) {
    console.warn("⚠️ 无法加载远程关键词配置", e);
  }
}

// ✅ 启动时加载配置，包进 async 函数，防止语法报错
(async () => {
  await fetchRemoteConfig();
  isReady = true;
})();
setInterval(fetchRemoteConfig, 30000);

// ======= 匹配函数 =======
function matchWholeWord(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower));
}

function matchSubstring(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some(w => lower.includes(w.toLowerCase()));
}

function extractUsername(text) {
  const match = text.match(/@([\w\-\.]+)\.bsky\.social/);
  return match ? match[1].toLowerCase() : "";
}

function normalize(text) {
  return text.toLowerCase().trim();
}

// ======= 控制变量 =======
let followCount = 0;
let processingCount = 0;
const maxConcurrent = 5;
const processedUsers = new Set();
const followQueue = [];

// ======= 核心处理逻辑 =======
async function handleCard(card) {
  try {
    if (!isReady || card.dataset.processed || isPaused || processingCount >= maxConcurrent) return;
    card.dataset.processed = "true";
    processingCount++;

    const cardText = card.innerText;
    const nickMatch = cardText.match(/^(.*?)\n@/);
    const nickname = nickMatch ? normalize(nickMatch[1]) : "";
    const username = extractUsername(cardText);
    const bioText = cardText.replace(nickMatch?.[0] || "", "").replace(/@\w+\.bsky\.social/, "").trim();
    const hasBio = bioText.length > 0;

    if (processedUsers.has(username)) {
      processingCount--;
      return;
    }
    processedUsers.add(username);

    // 黑名单匹配
    let isBlocked = false;
    if (matchSubstring(nickname, blockedNameKeywords) || matchSubstring(username, blockedNameKeywords)) {
      isBlocked = true;
    }
    if (!isBlocked && hasBio && matchWholeWord(bioText, blockedGeneralKeywords)) {
      isBlocked = true;
    }
    if (isBlocked) {
      console.warn(`⛔️ Blocked: ${nickname} (${username})`);
      processingCount--;
      return;
    }

    // 白名单匹配
    let matched = false;
    if (hasBio) {
      if (
        matchSubstring(nickname, targetNameKeywords) ||
        matchSubstring(username, targetNameKeywords) ||
        matchSubstring(bioText, targetGeneralKeywords)
      ) {
        matched = true;
      }
    } else {
      if (
        matchSubstring(nickname, targetNameKeywords) ||
        matchSubstring(username, targetNameKeywords) ||
        matchSubstring(nickname, targetGeneralKeywords) ||
        matchSubstring(username, targetGeneralKeywords)
      ) {
        matched = true;
      }
    }

    if (matched) {
      card._followBtn = card._followBtn ||
        card.querySelector('button[aria-label="Follow"], button[aria-label="关注"]');
      if (card._followBtn) {
        followQueue.push({ btn: card._followBtn, card });
        console.log(`🔜 Enqueued follow: ${nickname} (${username})`);
        card.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }

  } catch (err) {
    console.error("🚨 handleCard 错误", err);
  } finally {
    processingCount--;
  }
}

// ======= 队列处理 =======
async function dequeueFollow() {
  if (isPaused || followQueue.length === 0) {
    setTimeout(dequeueFollow, 500);
    return;
  }

  const { btn } = followQueue.shift();
  try {
    btn.click();
    followCount++;
    counterBox.innerText = `✅ Followed: ${followCount}`;
    console.log(`✅ Followed`);
  } catch (e) {
    console.warn("⚠️ Follow failed", e);
  } finally {
    setTimeout(dequeueFollow, 100);
  }
}
dequeueFollow();

// ======= 页面监听器 =======
const observer = new MutationObserver(() => {
  if (!isPaused) processAllCards();
});
observer.observe(document.body, { childList: true, subtree: true });

// ======= 主入口函数 =======
async function processAllCards() {
  if (isPaused || !isReady) return;
  const cards = Array.from(document.querySelectorAll('div[style*="padding"][style*="border-top-width"]'));
  for (const card of cards) {
    if (processingCount < maxConcurrent) {
      handleCard(card);
    }
  }
}

// ======= UI 显示框 =======
const counterBox = document.createElement("div");
Object.assign(counterBox.style, {
  position: "fixed", bottom: "20px", right: "20px",
  backgroundColor: "#222", color: "#0f0", padding: "10px 15px",
  borderRadius: "8px", fontSize: "14px", zIndex: "9999",
  boxShadow: "0 0 8px rgba(0,0,0,0.5)", display: "none"
});
counterBox.innerText = `✅ Followed: 0`;
document.body.appendChild(counterBox);

// ======= 快捷键控制 =======
alert("🟡 自动关注脚本已就绪，按 R 开始，按 Q 暂停");
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "q") {
    isPaused = true;
    counterBox.style.display = "none";
    console.log("⏸ 已暂停自动关注");
  } else if (key === "r") {
    isPaused = false;
    counterBox.style.display = "block";
    console.log("▶️ 已恢复自动关注");
    processAllCards();
  }
});
