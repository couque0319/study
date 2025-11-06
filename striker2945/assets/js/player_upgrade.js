// assets/js/player_upgrade.js
// 프레임워크 비의존 플레이어 강화 로직 (상점 구매 반영용)
// 전역 네임스페이스: window.PlayerUpgrade

(function (global) {
  'use strict';

  /** 스킨/스탯 테이블 (base(1).html에서 발췌·정리) */
  const BULLET_SKINS = ['bulletB1', 'bulletR1', 'bulletG1', 'bulletW1']; // 데미지 Lv 0~3 대응
  const FIRERATE_TABLE_MS = [120, 110, 95, 84];  // 연사력 Lv 0~3
  const DAMAGE_TABLE = [2, 4, 8, 16];         // 총알 데미지 Lv 0~3
  const MISSILE_DAMAGE_TABLE = [80, 100, 125, 150]; // 미사일 폭발 대미지 Lv 0~3

  /** 내부 상태 — 프레임워크에 독립적인 순수 데이터 */
  const state = {
    weapon: {
      fireRateMs: 333,
      bulletSpeed: 400,
      bulletKey: 'bulletB1', // 스킨
      pattern: 1,            // 1/2/3발 평행 사격
      spreadDeg: 10,
      damage: 20,
      hitboxScaleX: 1.0,
    },
    shop: {
      // 1: 기관포 2발, 2: 기관포 3발, 3: 미사일 해금, 4: 미사일 2발
      purchasedOnce: { '1': false, '2': false, '3': false, '4': false },
      // a: 연사, s: 데미지, d: 체력 (0~3)
      tier: { a: 0, s: 0, d: 0 }
    },
    // 선택: lastFired 보정 등을 하고 싶은 경우 외부에서 콜백 주입
    hooks: {
      /** (optional) 연사력이 빨라질 때 첫발 타이밍 보정하고 싶을 때 사용 */
      onFireRateDecreased: null, // (newFireRateMs) => void
      /** (optional) 무기 스킨/데미지/패턴 변경 직후 외부 렌더/프리팹 갱신 */
      onWeaponChanged: null,     // (weaponSnapshot) => void
      /** (optional) 미사일 대미지 갱신 후 외부 미사일 매니저 반영 */
      onMissileDamageChanged: null // (missileDamage) => void
    }
  };

  /** ----- 내부 유틸 ----- */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // 데미지 티어 → 탄 스킨
  function updateBulletSkinByDamageTier() {
    const s = clamp(state.shop.tier.s || 0, 0, 3);
    state.weapon.bulletKey = BULLET_SKINS[s];
  }

  // 연사력 티어 반영
  function applyROFByTier() {
    const a = clamp(state.shop.tier.a || 0, 0, 3);
    const prev = state.weapon.fireRateMs;
    const next = FIRERATE_TABLE_MS[a];
    state.weapon.fireRateMs = next;

    // 더 빨라진 경우 첫발 보정이 필요하면 외부 콜백 호출
    if (typeof state.hooks.onFireRateDecreased === 'function' && next < prev) {
      try { state.hooks.onFireRateDecreased(next); } catch (e) {}
    }
  }

  // 데미지 티어 반영
  function applyDamageByTier() {
    const s = clamp(state.shop.tier.s || 0, 0, 3);
    state.weapon.damage = DAMAGE_TABLE[s];
  }

  // 미사일 대미지 티어 반영
  function applyMissileDamageByTier() {
    const s = clamp(state.shop.tier.s || 0, 0, 3);
    const dmg = MISSILE_DAMAGE_TABLE[s];
    if (typeof state.hooks.onMissileDamageChanged === 'function') {
      try { state.hooks.onMissileDamageChanged(dmg); } catch (e) {}
    }
    return dmg;
  }

  // 구매 해금에 따른 평행발 패턴 결정
  function applyPatternByPurchases() {
    let p = 1; // 기본 1발
    if (state.shop.purchasedOnce['1']) p = 2;
    if (state.shop.purchasedOnce['2']) p = 3;
    state.weapon.pattern = p;
  }

  /** 모든 변화치 즉시 재계산(스킨/연사/데미지/패턴/미사일) */
  function reapplyAll() {
    updateBulletSkinByDamageTier();
    applyROFByTier();
    applyDamageByTier();
    const missileDamage = applyMissileDamageByTier();
    applyPatternByPurchases();

    if (typeof state.hooks.onWeaponChanged === 'function') {
      try { state.hooks.onWeaponChanged({ ...state.weapon }); } catch (e) {}
    }
    return { weapon: { ...state.weapon }, missileDamage };
  }

  /** ----- 공개 API ----- */

  /** 초기화(선택 파라미터: 초기 저장값/콜백 주입) */
  function init(opts = {}) {
    if (opts.purchasedOnce) {
      state.shop.purchasedOnce = { ...state.shop.purchasedOnce, ...opts.purchasedOnce };
    }
    if (opts.tier) {
      state.shop.tier = { ...state.shop.tier, ...opts.tier };
    }
    if (opts.hooks) {
      state.hooks = { ...state.hooks, ...opts.hooks };
    }
    return reapplyAll();
  }

  /** 현재 무기/상점 상태 조회 */
  const getWeapon = () => ({ ...state.weapon });
  const getShop = () => ({ purchasedOnce: { ...state.shop.purchasedOnce }, tier: { ...state.shop.tier } });

  /** 구매 처리(키: '1'~'7') → 적용 후 스냅샷 반환 */
  function buy(key) {
    const P = state.shop.purchasedOnce;
    const T = state.shop.tier;

    switch (String(key)) {
      case '1': if (!P['1']) P['1'] = true; break;         // 기관포 2발
      case '2': if (P['1'] && !P['2']) P['2'] = true; break;// 기관포 3발(1 선행)
      case '3': if (!P['3']) P['3'] = true; break;         // 미사일 해금
      case '4': if (P['3'] && !P['4']) P['4'] = true; break;// 미사일 2발(3 선행)
      case '5': T.a = clamp((T.a || 0) + 1, 0, 3); break;  // 연사력 Lv+1
      case '6': T.s = clamp((T.s || 0) + 1, 0, 3); break;  // 데미지 Lv+1
      case '7': T.d = clamp((T.d || 0) + 1, 0, 3); break;  // 체력 Lv+1 (체력 수치는 외부에서 반영)
      default: break;
    }
    return reapplyAll();
  }

  /** 외부에서 직접 수치를 셋업하고 싶을 때 */
  function setShopState(next) {
    if (next?.purchasedOnce) state.shop.purchasedOnce = { ...state.shop.purchasedOnce, ...next.purchasedOnce };
    if (next?.tier) state.shop.tier = { ...state.shop.tier, ...next.tier };
    return reapplyAll();
  }

  /** 저장/로드(선택) — 진행을 localStorage에 유지하고 싶을 때 */
  const STORAGE_KEY = 'player_upgrade_state_v1';
  function saveToStorage() {
    try {
      const dump = JSON.stringify({ shop: state.shop });
      localStorage.setItem(STORAGE_KEY, dump);
    } catch (_) {}
  }
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getShop();
      const obj = JSON.parse(raw);
      if (obj?.shop) setShopState(obj.shop);
    } catch (_) {}
    return getShop();
  }

  /** 미사일 HUD 텍스트 헬퍼(선택) */
  function getMissileHUDText({ now, lastFiredAt, cooldownMs, primaryHoldActive, unlocked }) {
    if (!unlocked) return '';
    if (primaryHoldActive) return '미사일 발사 중…';
    const remainMs = Math.max(0, cooldownMs - (now - lastFiredAt));
    return remainMs > 0 ? `미사일 냉각중: ${(remainMs / 1000).toFixed(1)}s` : '미사일 준비됨';
  }

  /** 공개 */
  global.PlayerUpgrade = {
    init,
    buy,
    setShopState,
    getWeapon,
    getShop,
    saveToStorage,
    loadFromStorage,
    // 고급: 직접 호출해서 일부만 갱신하고 싶을 때 노출
    _reapplyAll: reapplyAll,
    _applyROFByTier: applyROFByTier,
    _applyDamageByTier: applyDamageByTier,
    _applyPatternByPurchases: applyPatternByPurchases,
    _applyMissileDamageByTier: applyMissileDamageByTier,
    // HUD 유틸
    getMissileHUDText,
    // 테이블을 외부에서 참고하고 싶을 때(읽기전용)
    TABLES: {
      BULLET_SKINS: [...BULLET_SKINS],
      FIRERATE_TABLE_MS: [...FIRERATE_TABLE_MS],
      DAMAGE_TABLE: [...DAMAGE_TABLE],
      MISSILE_DAMAGE_TABLE: [...MISSILE_DAMAGE_TABLE]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
