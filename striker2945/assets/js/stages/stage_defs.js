// assets/js/stages/stage_defs.js
// StageManager.init(stageDef) / StageManager.update(dt, cbs)와 호환되는 자동 생성 버전
// - EASY: 웨이브 7개, HARD: 웨이브 10개
// - pattern/form은 가중 랜덤(★ spread 계열 자주 등장)
// - 기존 상수/도우미는 유지 (START/GAP 등)
// - midBoss/boss 타이밍은 예시 규칙

(function (global) {
  const NS = (global.StageDefs = global.StageDefs || {});
  const STAGES = (NS.STAGES = NS.STAGES || {});

  // ===== 공통 타임라인 상수 =====
  const START = 1200;  // EASY 첫 웨이브까지 대기(ms)
  const GAP   = 6000;  // EASY 웨이브 간격(ms)

  const START_H = 1000; // HARD 첫 웨이브까지 대기(ms)
  const GAP_H   = 4000; // HARD 웨이브 간격(ms)

  // ===== 기본 파라미터 =====
  const ENEMY_BASE   = { hp: 3, speedY: 70,  fireInt: 1000 }; // EASY 기본
  const ENEMY_BASE_H = { hp: 4, speedY: 84,  fireInt: 850  }; // HARD 시작점

  // ===== 도우미(보스/중간보스 타이밍) =====
  const bossAt = (start, gap, lastOffset, delay=3500) => (start + gap * lastOffset) + delay;
  const midAt  = (start, gap, thirdOffset, delay=3000) => (start + gap * thirdOffset) + delay;

  // ===== 유틸 =====
  const rand = (min, max) => Math.random() * (max - min) + min;
  const rint = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 가중치 기반 선택
  function weightedPick(entries /* [ [value, weight], ... ] */) {
    let sum = 0;
    for (const [, w] of entries) sum += w;
    let t = Math.random() * sum;
    for (const [val, w] of entries) {
      if ((t -= w) <= 0) return val;
    }
    return entries[entries.length - 1][0];
  }

  // ===== 가중 테이블 =====
  // ★ spread 계열 우세
  const PATTERN_WEIGHTS_EASY = [
    ['straight', 1.0],
    ['aim',      1.2],
    ['spread3',  1.6],
    ['spread5',  1.6],
  ];
  const PATTERN_WEIGHTS_HARD = [
    ['straight', 0.9],
    ['aim',      1.3],
    ['spread3',  1.9],
    ['spread5',  1.9],
  ];

  // form은 random이 약간 더 자주, hard에서는 edges도 조금 상향
  const FORM_WEIGHTS_EASY = [
    ['line',   1.0],
    ['random', 1.3],
    ['edges',  0.9],
  ];
  const FORM_WEIGHTS_HARD = [
    ['line',   1.0],
    ['random', 1.4],
    ['edges',  1.1],
  ];

  // ===== 웨이브 생성기 (EASY) =====
  function genEasyWaves(n, start, gap, baseEnemy) {
    // 웨이브 수량 커브(뒤로 갈수록 증가)
    const countCurve = [1, 1, 2, 2, 3, 3, 4];
    const waves = [];

    for (let i = 0; i < n; i++) {
      const pattern = weightedPick(PATTERN_WEIGHTS_EASY);
      const form    = weightedPick(FORM_WEIGHTS_EASY);

      const w = {
        t: start + gap * i,
        count: countCurve[Math.min(i, countCurve.length - 1)],
        pattern,
        form,
        enemy: { ...baseEnemy }
      };

      // random 폼은 꼬리 간격 자주 부여
      if (form === 'random') {
        w.scatter = rint(8, 13); // 8~13px
      }

      // edges 폼은 가끔 좌우 이동을 부여
      if (form === 'edges' && Math.random() < 0.5) {
        w.vx = (Math.random() < 0.5 ? -1 : 1) * rint(20, 60);
      }

      // repeat/every: EASY는 낮은 확률, 짧은 반복
      if (Math.random() < 0.40) {
        w.repeat = 1 + (Math.random() < 0.5 ? 1 : 2); // 2~3회
        w.every  = rint(700, 1100);                   // 700~1100ms
      }

      // 패턴별 소폭 조정(선택): spread는 발사 빈도 약간 빠르게(= fireInt 감소)
      if (pattern === 'spread3' || pattern === 'spread5') {
        w.enemy.fireInt = clamp((baseEnemy.fireInt|0) - rint(80, 140), 600, 1200);
      }

      waves.push(w);
    }
    return waves;
  }

  // ===== 웨이브 생성기 (HARD) =====
  function genHardWaves(n, start, gap, baseEnemy) {
    // 초반 3~6, 후반 8~12로 증가하는 기본 값
    const baseCounts = [3,4,5,6,7,8,9,10,11,12];
    const waves = [];

    for (let i = 0; i < n; i++) {
      const pattern = weightedPick(PATTERN_WEIGHTS_HARD);
      const form    = weightedPick(FORM_WEIGHTS_HARD);

      const w = {
        t: start + gap * i,
        count: baseCounts[i] || baseCounts[baseCounts.length - 1],
        pattern,
        form,
        enemy: { ...baseEnemy }
      };

      // random 폼: 꼬리 간격 더 큼
      if (form === 'random') {
        w.scatter = rint(10, 15);
      }

      // edges 폼: 좌우 스윕을 더 자주/강하게
      if (form === 'edges' && Math.random() < 0.7) {
        w.vx = (Math.random() < 0.5 ? -1 : 1) * rint(30, 80);
      }

      // repeat/every: HARD는 높은 확률, 반복 횟수/빈도 상향
      if (Math.random() < 0.65) {
        w.repeat = 2 + (Math.random() < 0.5 ? 1 : 2); // 3~4회
        w.every  = rint(580, 850);                    // 580~850ms
      }

      // 패턴별 소폭 조정: spread는 더 자주 쏘게
      if (pattern === 'spread3' || pattern === 'spread5') {
        w.enemy.fireInt = clamp((baseEnemy.fireInt|0) - rint(120, 200), 520, 1100);
      } else if (pattern === 'aim') {
        // 하드에서 aim은 탄압박을 위해 fireInt 소폭 감소
        w.enemy.fireInt = clamp((baseEnemy.fireInt|0) - rint(60, 120), 620, 1100);
      }

      waves.push(w);
    }
    return waves;
  }

  // =========================================
  // EASY — 1~10 스테이지 자동 생성 (각 7웨이브)
  // midBoss: 03/06/08, boss: 09/10 (예시)
  // =========================================
  STAGES.easy = STAGES.easy || {};
  for (let i = 1; i <= 10; i++) {
    const id = String(i).padStart(2, '0');
    const waves = genEasyWaves(7, START, GAP, ENEMY_BASE);

    const mids = [];
    if ([3, 6, 8].includes(i)) {
      mids.push({ at: midAt(START, GAP, 2), key: 'midboss1' });
    }
    const boss = ([9, 10].includes(i)) ? { at: bossAt(START, GAP, 6), key: 'boss1' } : null;

    STAGES.easy[id] = {
      id,
      difficulty: 'easy',
      waves,
      midBoss: mids,
      boss
    };
  }

  // =========================================
  // HARD — 1~10 스테이지 자동 생성 (각 10웨이브)
  // midBoss: 03/06/07, boss: 08/09/10 (예시)
  // =========================================
  STAGES.hard = STAGES.hard || {};
  for (let i = 1; i <= 10; i++) {
    const id = String(i).padStart(2, '0');
    const waves = genHardWaves(10, START_H, GAP_H, ENEMY_BASE_H);

    const mids = [];
    if ([3, 6, 7].includes(i)) {
      mids.push({ at: midAt(START_H, GAP_H, 2), key: 'midboss1' });
    }
    // 보스는 후반 3스테이지 고정 등장(예시)
    const boss = ([8, 9, 10].includes(i)) ? { at: bossAt(START_H, GAP_H, 9), key: 'boss1' } : null;

    STAGES.hard[id] = {
      id,
      difficulty: 'hard',
      waves,
      midBoss: mids,
      boss
    };
  }
})(window);
