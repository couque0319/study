// assets/js/stages/stage_manager.js
// Canvas 전용 StageManager — 타임라인 기반 웨이브/보스 스폰 + repeat/every 지원 + 스케줄 소진 체크
(function (global) {
  const NS = (global.StageManager = global.StageManager || {});

  // ===== 내부 상태 =====
  let def = null;         // 현재 스테이지 정의 (stage_defs.js에서 제공)
  let time = 0;           // 경과 시간(ms)
  let cursor = 0;         // waves 진행 인덱스
  let emittedBoss = false;
  let midIdx = 0;         // midBoss 진행 인덱스
  const extraQueue = [];  // repeat/every로 추가 스케줄되는 웨이브 큐

  // 화면 동시 출현 적 수 제한 (기본 무제한)
   let enemyCap = Infinity;

   // 외부에서 캡을 설정할 수 있게 제공
   NS.setEnemyCap = function setEnemyCap(cap) {
     enemyCap = Number.isFinite(cap) && cap > 0 ? cap : Infinity;
   };

  // ===== 퍼블릭 API =====

  /**
   * 스테이지 초기화
   * @param {Object} stageDef - { id, difficulty, waves:[...], midBoss:[{at,key}], boss:{at,key} }
   */
  NS.init = function init(stageDef) {
    def = stageDef || null;
    time = 0;
    cursor = 0;
    emittedBoss = false;
    midIdx = 0;
    extraQueue.length = 0;
  };

  /**
   * (NEW) 스폰 스케줄이 전부 소진되었는지 확인
   * - 모든 웨이브 소비, 반복 큐 비었음, 중간보스 모두 발사, (보스가 있으면) 소환 시점까지 처리됨
   * @returns {boolean}
   */
  NS.isAllScheduled = function isAllScheduled() {
    if (!def) return false;
    const wavesDone = cursor >= ((def.waves || []).length);
    const midsDone  = midIdx >= ((def.midBoss || []).length);
    const bossDone  = !def.boss || emittedBoss;
    return wavesDone && midsDone && bossDone && extraQueue.length === 0;
  };

  /**
   * 메인 업데이트 — game.js에서 매 프레임 고정 dt(ms)로 호출
   * @param {number} dt - 경과 시간(ms)
   * @param {Object} cbs - 콜백들 { onTip, onSpawnEnemy, onSpawnMidBoss, onSpawnBoss }
   */
  NS.update = function update(dt, cbs) {
    if (!def) return;
    time += dt;

    const waves = def.waves || [];

    // 1) 기본 타임라인: 예정된 웨이브를 순차 실행
    while (cursor < waves.length && time >= waves[cursor].t) {
      const w = waves[cursor++];
      spawnWave(w, cbs);

      // repeat/every: w를 추가 스케줄링
      if (w.repeat && w.repeat > 1 && w.every && w.every > 0) {
        for (let i = 1; i < w.repeat; i++) {
          extraQueue.push({ t: w.t + w.every * i, w });
        }
      }
      cbs.onTip && cbs.onTip(`Wave ${cursor}`);
    }

    // 2) 추가 큐 처리
    for (let i = extraQueue.length - 1; i >= 0; i--) {
      const item = extraQueue[i];
      if (time >= item.t) {
        spawnWave(item.w, cbs);
        extraQueue.splice(i, 1);
      }
    }

    // 3) 중간보스(여러 개 가능)
    const mids = def.midBoss || [];
    while (midIdx < mids.length && time >= mids[midIdx].at) {
      const mb = mids[midIdx++];
      cbs.onTip && cbs.onTip('Mid-Boss!');
      if (cbs.onSpawnMidBoss) cbs.onSpawnMidBoss(mb.key || 'midboss1');
      else if (cbs.onSpawnBoss) cbs.onSpawnBoss(mb.key || 'midboss1'); // 폴백
    }

    // 4) 최종 보스(단일)
    if (def.boss && !emittedBoss && time >= def.boss.at) {
      emittedBoss = true;
      cbs.onTip && cbs.onTip('Boss Approaching!');
      cbs.onSpawnBoss && cbs.onSpawnBoss(def.boss.key || 'boss1');
    }
  };

  // ===== 내부 유틸 =====
  const W = 480, H = 720;
  const rand = (min, max) => Math.random() * (max - min) + min;

  /**
   * 웨이브 스폰 — form/pattern/파라미터에 따라 적을 생성
   * @param {Object} w  - 웨이브 정의
   * @param {Object} cbs - 콜백 묶음
   */
  function spawnWave(w, cbs) {
    const { pattern, form, count } = w;
    const enemy = w.enemy || {};

    // 기본값(누락 시 안전값)
    const hp       = Number.isFinite(enemy.hp) ? enemy.hp : 3;
    const speedY   = Number.isFinite(enemy.speedY) ? enemy.speedY : 70;
    const fireInt  = Number.isFinite(enemy.fireInt) ? enemy.fireInt : 1000;

    // 오버라이드(폼 기본값을 강제로 덮어씀)
    const vxOverride = Number.isFinite(w.vx) ? w.vx : null;
    const vyOverride = Number.isFinite(w.vy) ? w.vy : null;

    // random 폼 꼬리 간격(px) — 기본 6
    const scatter = Number.isFinite(w.scatter) ? w.scatter : 6;

    // form 라우팅
    if (form === 'line') {
      // 상단 균등 배치
      const left = 40, right = W - 40;
      const n = Math.max(1, Math.floor(count || 0));
      for (let i = 0; i < n; i++) {
        const t = (n === 1) ? 0.5 : (i / (n - 1));
        const x = left + (right - left) * t;
        const y = -20;
        cbs.onSpawnEnemy && cbs.onSpawnEnemy({
          x, y,
          vx: (vxOverride ?? 0),
          vy: (vyOverride ?? speedY),
          hp, fireInt, pattern
        });
      }
    } else if (form === 'edges') {
      // 좌/우 측면에서 진입
      const n = Math.max(1, Math.floor(count || 0));
      for (let i = 0; i < n; i++) {
        const fromLeft = (i % 2 === 0);
        const x = fromLeft ? 20 : W - 20;
        const y = rand(40, 160);
        const vx = fromLeft ? rand(20, 60) : rand(-60, -20);
        cbs.onSpawnEnemy && cbs.onSpawnEnemy({
          x, y,
          vx: (vxOverride ?? vx),
          vy: (vyOverride ?? (speedY * 0.7)),
          hp, fireInt, pattern
        });
      }
    } else {
      // 'random' 또는 그 외 → 상단에서 랜덤 X
      const n = Math.max(1, Math.floor(count || 0));
      for (let i = 0; i < n; i++) {
        const x = rand(30, W - 30);
        const y = -20 - i * scatter; // 꼬리 물기
        cbs.onSpawnEnemy && cbs.onSpawnEnemy({
          x, y,
          vx: (vxOverride ?? 0),
          vy: (vyOverride ?? speedY),
          hp, fireInt, pattern
        });
      }
    }
  }
})(window);
