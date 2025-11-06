// assets/js/shop_event.js
// 보스/중간보스 격파 후 등장하는 상점 이벤트 처리
// PlayerUpgrade.js와 연동됨 (없어도 열리지만 구매효과는 비활성)

(function () {
  'use strict';

  // 내부 상태(중복 바인딩 방지용)
  let shopOverlay, shopButtons, shopCloseBtn, shopTitle, shopInfo;
  let initialized = false;

  function ensureOverlayExists() {
    shopOverlay = document.getElementById('shop-overlay');
    if (shopOverlay) {
      // 이미 존재
      shopTitle = document.getElementById('shop-title');
      shopInfo = document.getElementById('shop-info');
      shopCloseBtn = document.getElementById('shop-close-btn');
      shopButtons = document.querySelectorAll('.shop-item');
      return;
    }

    // 없으면 즉석 생성
    shopOverlay = document.createElement('div');
    shopOverlay.id = 'shop-overlay';
    shopOverlay.className = 'shop-overlay';
    shopOverlay.style.cssText = `
      position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); z-index: 9999;
    `;

    shopOverlay.innerHTML = `
      <div class="shop-box" style="
        background:#111; color:#fff; padding:16px 18px; border-radius:12px;
        width: min(420px, 92%); box-shadow:0 8px 24px rgba(0,0,0,0.5);
        font-family: ui-sans-serif,system-ui,Segoe UI,Apple SD Gothic Neo,Malgun Gothic,Arial;
      ">
        <h2 id="shop-title" style="margin:6px 0 10px 0; font-size:18px;">보급 상점</h2>

        <div id="shop-info" style="font-size:12px; opacity:.9; margin-bottom:10px;"></div>

        <div class="shop-items" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button class="shop-item" data-item="1">기관포 2줄</button>
          <button class="shop-item" data-item="2">기관포 3줄</button>
          <button class="shop-item" data-item="3">미사일 해금</button>
          <button class="shop-item" data-item="4">미사일 2발</button>
          <button class="shop-item" data-item="5">연사력 강화</button>
          <button class="shop-item" data-item="6">데미지 강화</button>
          <button class="shop-item" data-item="7">체력 강화</button>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:12px;">
          <button id="shop-close-btn" style="padding:6px 10px;">닫기</button>
        </div>
      </div>
    `;

    document.body.appendChild(shopOverlay);

    // refs 갱신
    shopTitle = document.getElementById('shop-title');
    shopInfo = document.getElementById('shop-info');
    shopCloseBtn = document.getElementById('shop-close-btn');
    shopButtons = document.querySelectorAll('.shop-item');
  }

  function initShopElements() {
    ensureOverlayExists();

    // 중복 바인딩 방지: 기존 리스너 제거
    if (shopButtons && shopButtons.forEach) {
      shopButtons.forEach((btn) => {
        btn.removeEventListener('click', onBuyButtonClick);
      });
    }
    if (shopCloseBtn) {
      shopCloseBtn.removeEventListener('click', closeShop);
    }

    // 새로 바인딩
    if (shopButtons && shopButtons.forEach) {
      shopButtons.forEach((btn) => btn.addEventListener('click', onBuyButtonClick));
    }
    if (shopCloseBtn) {
      shopCloseBtn.addEventListener('click', closeShop);
    }

    initialized = true;
  }

  /** 상점 열기(보스 격파 시 호출) */
  function openShop() {
    if (!initialized) initShopElements();

    // 방어: 요소가 정말 있는지 재확인
    if (!shopOverlay) {
      console.error('[ShopEvent] shop overlay not found and could not be created.');
      return;
    }

    shopOverlay.style.display = 'flex';
    if (shopTitle) shopTitle.textContent = '보급 상점 - 아이템을 구매하여 강화하세요!';
    updateShopStatusUI();
  }

  /** 상점 닫기 */
  function closeShop() {
    if (shopOverlay) shopOverlay.style.display = 'none';

    // 게임 재개
    if (typeof window.Game?.resume === 'function') {
      window.Game.resume();
    }
  }

  /** 구매 처리 */
  function onBuyButtonClick(e) {
    const key = e.currentTarget?.dataset?.item; // '1'~'7'
    if (!key) return;

    if (typeof window.PlayerUpgrade !== 'undefined' && typeof window.PlayerUpgrade.buy === 'function') {
      const snapshot = window.PlayerUpgrade.buy(key);
      if (typeof window.PlayerUpgrade.saveToStorage === 'function') {
        window.PlayerUpgrade.saveToStorage();
      }
      // 버튼 UI 업데이트
      e.currentTarget.disabled = true;
      e.currentTarget.classList.add('bought');
      showToast(`${key}번 아이템 구매 완료!`);
      updateShopStatusUI(snapshot);
    } else {
      // PlayerUpgrade가 없을 때도 죽지 않도록
      showToast('아이템 구매가 적용되지 않았습니다(PlayerUpgrade 미탑재).');
    }
  }

  /** 구매 결과/현재 상태 표시 */
  function updateShopStatusUI(snapshot) {
    const w = snapshot?.weapon || window.PlayerUpgrade?.getWeapon?.();
    if (!shopInfo) return;
    if (!w) {
      shopInfo.textContent = '';
      return;
    }
    shopInfo.innerHTML = `
      <div>연사속도: ${w.fireRateMs}ms</div>
      <div>데미지: ${w.damage}</div>
      <div>탄 패턴: ${w.pattern}발</div>
      <div>탄 이미지: ${w.bulletKey}</div>
    `;
  }

  /** 간단 토스트 */
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed; left: 50%; top: 16px; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color:#fff; padding:8px 12px; border-radius:8px;
      z-index:10000; opacity:0; transition: opacity .2s ease;
      font-size: 13px;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = '1'));
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 1400);
  }

  // 전역 노출
  window.ShopEvent = {
    open: openShop,
    close: closeShop,
  };
})();
