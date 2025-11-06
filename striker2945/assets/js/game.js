// game.js — Canvas STG 최종본
// 요구사항 통합: 이미지 렌더(플레이어/탄/적), StageManager 연동, 스테이지 클리어

(function(){
  // ====== 캔버스/컨텍스트 ======
  const W = 480, H = 720;
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  cvs.width = W; cvs.height = H;

  // ===== PlayerUpgrade 연동: 현재 무기 스냅샷 =====
  // 상점 구매 → PlayerUpgrade 내부 계산 → 아래 weaponState에 즉시 반영
  let weaponState = {
    fireRateMs: 200,
    pattern: 1,
    spreadDeg: 10,
    bulletKey: 'bulletB1',
    bulletSpeed: 420,
    damage: 20
  };
  let lastShotAt = 0; // 자동 사격 타이머

  // PlayerUpgrade 초기화 및 연동
  if (window.PlayerUpgrade) {
    // 저장된 상태 로드
    window.PlayerUpgrade.loadFromStorage();
    // 무기 상태 업데이트 훅 설정
    const initialWeaponState = window.PlayerUpgrade.init({
      hooks: {
        onWeaponChanged: (snapshot) => {
          weaponState = { ...snapshot };
        }
      }
    });
    // 초기 무기 상태 반영
    weaponState = { ...initialWeaponState.weapon };

    // 플레이어 HP 티어 저장 (player 객체 정의 후 적용)
    const shopState = window.PlayerUpgrade.getShop();
    const initialHpTier = shopState.tier.d || 0;

  } else {
    console.warn('PlayerUpgrade 모듈을 찾을 수 없습니다.');
  }

  // ====== 유틸 ======
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const nowMS = ()=> performance.now();

  const CULL_MARGIN = 32;
  function isOffscreen(x, y, r = 0){
    return (x < -CULL_MARGIN - r) || (x > W + CULL_MARGIN + r) ||
           (y < -CULL_MARGIN - r) || (y > H + CULL_MARGIN + r);
  }

  // ====== 입력 ======
  const key = {};
  const mouse = { x: W/2, y: H-80 };
  const controlMode = localStorage.getItem('playerControl') || 'arrows'; // 'arrows', 'wasd', 'mouse'

  addEventListener('keydown', e => key[e.code]=true);
  addEventListener('keyup',   e => key[e.code]=false);
  
  // 마우스 리스너 (마우스 조작 모드일 때만 필요)
  if (controlMode === 'mouse') {
    cvs.addEventListener('mousemove', e => {
      const rect = cvs.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
  }

  // ====== 전역 상태 ======
  let lastTS = nowMS();
  let acc = 0;
  const FIXED_DT = 1000/60; // 60fps 고정
  const AUTO_FIRE_MS = 200;
  const BOSS_HIT_RADIUS    = 30; // 보스: 원래 r=24, 판정만 넓힘
  const MIDBOSS_HIT_RADIUS = 26; // 중간보스: 원래 r=20, 판정만 넓힘
  let isGameOver = false;
  let gameOverTime = 0;

  // 일시정지/상점 플래그
  let isPaused = false;
  let shopOpenedThisPhase = false;

  // ====== 플레이어 선택 및 설정 ======
  // 기체별 스펙 정의
  const planeSpecs = {
    airplane1: {
      imgSrc: 'assets/images/player/player1_frame1.png', // TYPE-A: Striker
      spd: 200,
      hp: 3
    },
    airplane2: {
      imgSrc: 'assets/images/player/player2_frame1.png', // TYPE-B: Interceptor
      spd: 260, // 더 빠름
      hp: 2    // 더 약함
    }
  };

  // 체력 업그레이드 테이블 (tier.d 0~3)
  const HP_TABLE = [3, 4, 5, 6];

  // 로컬 스토리지에서 선택된 기체 가져오기 (없으면 기본값 사용)
  const selectedPlaneId = localStorage.getItem('selectedAirplane') || 'airplane1';
  const currentSpec = planeSpecs[selectedPlaneId] || planeSpecs.airplane1;

  // ====== 플레이어 ======
  const player = {
    x: W*0.5, y: H-80, r: 8,
    spd: currentSpec.spd, // 선택된 기체 스피드
    fireCd: 0,
    blink: 0,
    alive: true,
    hp: currentSpec.hp,      // 선택된 기체 체력
    opacity: 1.0,             // 플레이어 불투명도 (캐리어 진입 모션용)
    coins: 0                  // 플레이어 코인
  };

  // PlayerUpgrade에서 로드된 HP 티어 적용
  if (window.PlayerUpgrade && typeof initialHpTier !== 'undefined') {
    player.hp = HP_TABLE[initialHpTier];
  }

  // 게임 진행 상태 로드 (코인 등)
  loadGameProgress();

  // ====== 이미지: 로더 없이 즉시 생성(렌더 시 안전 체크) ======
  // 플레이어
  const playerImg = new Image();
  playerImg.src = currentSpec.imgSrc; // 선택된 기체 이미지

  // 캐리어 이미지
  const carrierImg = new Image();
  carrierImg.src = 'assets/images/carrier1.png';

  // 플레이어 탄 이미지들
  const bulletImages = {};
  const BULLET_SKINS = ['bulletB1', 'bulletR1', 'bulletG1', 'bulletW1'];
  const defaultBulletImg = new Image();
  defaultBulletImg.src = 'assets/images/bullets/bullet1.png';
  BULLET_SKINS.forEach(key => {
    bulletImages[key] = defaultBulletImg;
  });

  // 적 이미지(en1~en13)
  const enemyImages = [];
  for (let i=1;i<=13;i++){
    const img = new Image();
    img.src = `assets/images/enemy/en${i}.png`;
    enemyImages.push(img);
  }

  // 적 탄 이미지(고정 1장)
  const enemyBulletImg = new Image();
  enemyBulletImg.src = 'assets/images/enemy_bullet/enemy_bullet.png';

  // ====== 오디오 효과 ======
  const hitSound = new Audio('assets/audio/hit.mp3');
  hitSound.volume = 0.6;  // 볼륨 (0.0~1.0 사이 조절 가능)

  // 게임 오버 사운드
  const gameOverSound = new Audio('assets/audio/game_over.mp3');
  gameOverSound.volume = 0.7;

  // ====== 오브젝트 풀 ======
  function makePool(factory, size){
    const arr = new Array(size).fill(0).map(factory);
    return {
      arr,
      get(){
        for(let i=0;i<arr.length;i++){
          if(!arr[i].active) return arr[i];
        }
        return null;
      }
    };
  }

  const pBullets = makePool(()=>({active:false,x:0,y:0,vx:0,vy:-360,img:null}), 512);
  const eBullets = makePool(()=>({active:false,x:0,y:0,vx:0,vy:120,img:null}), 768);
  const enemies  = makePool(()=>({active:false,x:0,y:0,vx:0,vy:70,hp:3,r:14,t:0,fireInt:1000,fireT:0,pattern:'straight',img:null}), 256);

  // [추가] 보스 이미지 로드
  const bossImages = [];
  for (let i = 1; i <= 5; i++) { // boss1.png~boss5.png 등 여러 장일 경우
    const img = new Image();
    img.src = `assets/images/boss/boss${i}.png`;
    bossImages.push(img);
  }

  // ====== 보스(단일 슬롯) ======
  let boss = null;
  function spawnBoss(){
    const bossImg = bossImages.length ? bossImages[Math.floor(Math.random() * bossImages.length)] : null;
    boss = {
      active:true, x:W*0.5, y:-60, vx:0, vy:60,
      r:24, hitR:BOSS_HIT_RADIUS, hp:120,
      t:0, fireInt:600, fireT:0,
      img: bossImg // 🔹 이미지 적용
    };
  }
  function spawnMiniBoss(){
    const bossImg = bossImages.length ? bossImages[0] : null; // 첫 번째 이미지를 중간보스로 사용
    boss = {
      active:true, x:W*0.5, y:-60, vx:0, vy:60,
      r:20, hitR:MIDBOSS_HIT_RADIUS, hp:70,
      t:0, fireInt:800, fireT:0,
      img: bossImg // 🔹 이미지 적용
    };
  }

  // ====== 스테이지 클리어 상태 ======
  let stageCleared = false;
  let stageClearTime = 0;
  let bannerAlpha = 0;

  // ====== 캐리어 이벤트 상태 ======
  let carrierEventActive = false;
  let carrierY = -200; // 캐리어 초기 Y 위치 (화면 밖 위쪽)
  const CARRIER_TARGET_Y = H / 2 - 100; // 캐리어가 멈출 Y 위치
  const CARRIER_EXIT_Y = -200; // 캐리어가 나갈 Y 위치
  const CARRIER_SPEED = 80; // 캐리어 이동 속도
  let playerAttachedToCarrier = false;
  let carrierAnimationPhase = 0; // 0: 등장, 1: 플레이어 대기, 2: 플레이어 탑승, 3: 퇴장

  // 진행도 저장 (클리어 시 다음 스테이지 해제)
  function saveProgressAfterClear(){
    try {
      const key = (difficulty === 'easy') ? 'progress_easy' : 'progress_hard';
      const cur = parseInt(localStorage.getItem(key) || '1', 10);
      const sNum = parseInt(stage, 10) || 1;
      const nextUnlock = Math.min(10, Math.max(cur, sNum + 1));
      localStorage.setItem(key, String(nextUnlock));
    } catch(_) {}
  }

  // 게임 진행 상태 저장 (코인 등)
  function saveGameProgress() {
    try {
      localStorage.setItem('player_coins', String(player.coins));
    } catch (_) {}
  }

  // 게임 진행 상태 로드 (코인 등)
  function loadGameProgress() {
    try {
      const savedCoins = parseInt(localStorage.getItem('player_coins') || '0', 10);
      if (Number.isFinite(savedCoins)) {
        player.coins = savedCoins;
      }
    } catch (_) {}
  }

  // ====== 스폰 함수 ======
  function tHP(h){ return h|0; }

  function spawnEnemy(x,y,vx,vy,hp,fireInt,pattern){
    const e = enemies.get(); if(!e) return null;
    const img = enemyImages.length ? enemyImages[(Math.random()*enemyImages.length)|0] : null;
    Object.assign(e,{active:true,x,y,vx,vy,hp:tHP(hp),r:19,t:0,fireInt,fireT:0,pattern,img});
    return e;
  }

  function spawnPBullet(x,y,vy,img){
    const b = pBullets.get(); if(!b) return null;
    Object.assign(b,{active:true,x,y,vx:0,vy,img: img || defaultBulletImg});
    return b;
  }

  function spawnEBullet(x,y,vx,vy){
    const b = eBullets.get(); if(!b) return null;
    Object.assign(b,{active:true,x,y,vx,vy,img: enemyBulletImg || null});
    return b;
  }

  // ====== 스테이지/쿼리 ======
  function getQuery(){
    const p = new URLSearchParams(location.search);
    return { difficulty: p.get('difficulty') || 'easy', stage: p.get('stage') || '01' };
  }
  const {difficulty, stage} = getQuery();
  const isEasy = (difficulty === 'easy');
  // 이지 모드에서만 적 탄속에 곱해줄 스케일(30% 감속)
  const EASY_EBULLET_SPEED_SCALE = 0.70;

  // ====== 상점 연동(일시정지/재개) ======
  // 외부에서 ShopEvent.close()가 Game.resume()을 호출함
  const Game = (window.Game = window.Game || {});
  Game.pause = function(){ isPaused = true; };
  Game.resume = function(){ isPaused = false; };
  Game.player = player; // player 객체를 Game 전역 객체에 노출
  function openShopOnce(){
    if (shopOpenedThisPhase) return;
    shopOpenedThisPhase = true;
    Game.pause();
     if (window.ShopEvent && typeof window.ShopEvent.open === 'function') {
      window.ShopEvent.open();
    } else {
      console.warn('ShopEvent 모듈을 찾을 수 없습니다. 상점을 건너뜁니다.');
      Game.resume();
    }
  }

  // ====== 토스트/Tip(옵션) ======
  let tipMsg = ''; let tipTime = 0;
  function showTip(s){ tipMsg = s; tipTime = nowMS(); }

  // ====== 플레이어 이동 처리 함수 (신규) ======
  function handlePlayerMovement(dt) {
    if (!player.alive) return;

    const spd = player.spd * (key['ShiftLeft'] || key['ShiftRight'] ? 0.5 : 1);
    const moveAmount = spd * dt / 1000;

    if (controlMode === 'mouse') {
      // 마우스 모드: 마우스 위치로 부드럽게 이동
      const dx = mouse.x - player.x;
      const dy = mouse.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // 너무 가까우면 바로 위치 설정
      if (dist < 1) {
        player.x = mouse.x;
        player.y = mouse.y;
      } else {
        // 거리가 멀면 따라가도록 설정 (Lerp)
        player.x += dx * 0.2;
        player.y += dy * 0.2;
      }
    } else {
      // 키보드 모드 (방향키 또는 WASD)
      if (controlMode === 'arrows') {
        if (key['ArrowLeft'])  player.x -= moveAmount;
        if (key['ArrowRight']) player.x += moveAmount;
        if (key['ArrowUp'])    player.y -= moveAmount;
        if (key['ArrowDown'])  player.y += moveAmount;
      } else if (controlMode === 'wasd') {
        if (key['KeyA']) player.x -= moveAmount;
        if (key['KeyD']) player.x += moveAmount;
        if (key['KeyW']) player.y -= moveAmount;
        if (key['KeyS']) player.y += moveAmount;
      }
    }

    // 화면 밖으로 나가지 않도록 위치 보정
    player.x = clamp(player.x, 14, W - 14);
    player.y = clamp(player.y, 20, H - 20);
  }

  // ====== 업데이트 로직 ======
  function update(dt){
    // 일시정지 시 로직 정지(렌더는 계속)
    // 스테이지 클리어 후 캐리어 이벤트가 진행 중일 때는 일시정지하지 않음
    if (isPaused && !carrierEventActive) return;

    // 캐리어 이벤트 중일 때
    if (carrierEventActive) {
      // 캐리어 이미지 로드 확인
      if (!carrierImg || !carrierImg.complete || carrierImg.naturalWidth === 0) {
        // 이미지가 로드되지 않았으면 대기
        return;
      }

      const carrierHalfW = carrierImg.naturalWidth / 2;
      const carrierHalfH = carrierImg.naturalHeight / 2;

      switch (carrierAnimationPhase) {
        case 0: // 캐리어 등장 (화면 위에서 중앙으로)
          console.log('Carrier Phase 0: Approaching');
          carrierY += CARRIER_SPEED * dt / 1000;
          if (carrierY >= CARRIER_TARGET_Y) {
            carrierY = CARRIER_TARGET_Y;
            carrierAnimationPhase = 1; // 플레이어 대기
            console.log('Carrier Phase 0 -> 1: Player wait');
          }
          break;
        case 1: // 플레이어 대기 (캐리어 중앙으로 이동)
          console.log('Carrier Phase 1: Player moving to carrier');
          // 플레이어가 캐리어 중앙으로 이동하는 로직
          const targetPlayerX = W / 2;
          const targetPlayerY = carrierY; // 캐리어 중앙으로 이동
          const dx = targetPlayerX - player.x;
          const dy = targetPlayerY - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const playerMoveSpeed = player.spd * dt / 1000;

          if (dist > playerMoveSpeed) {
            player.x += (dx / dist) * playerMoveSpeed;
            player.y += (dy / dist) * playerMoveSpeed;
          } else {
            player.x = targetPlayerX;
            player.y = targetPlayerY;
            playerAttachedToCarrier = true;
            carrierAnimationPhase = 2; // 플레이어 탑승 완료, 잠시 대기
            console.log('Carrier Phase 1 -> 2: Player attached, waiting');
            setTimeout(() => {
              carrierAnimationPhase = 3; // 캐리어 퇴장
              console.log('Carrier Phase 2 -> 3: Carrier exiting');
            }, 1000); // 1초 대기
          }
          break;
        case 2: // 플레이어 탑승 완료, 대기 중
          console.log('Carrier Phase 2: Waiting for exit timer');
          // 플레이어 위치를 캐리어에 고정
          player.x = W / 2;
          player.y = carrierY; // 캐리어 중앙에 고정
          // 플레이어 불투명도 감소 시작
          player.opacity = Math.max(0, player.opacity - dt / 1000); // 1초 동안 서서히 사라짐
          break;
        case 3: // 캐리어 퇴장 (화면 위로 사라짐)
          console.log('Carrier Phase 3: Exiting');
          carrierY -= CARRIER_SPEED * dt / 1000;
          // 플레이어도 캐리어와 함께 이동
          player.y = carrierY; // 캐리어와 함께 이동
          // 플레이어 불투명도 계속 감소
          player.opacity = Math.max(0, player.opacity - dt / 1000);
          if (carrierY < CARRIER_EXIT_Y) {
            carrierEventActive = false; // 이벤트 종료
            console.log('Carrier Event Finished. Redirecting.');
            goNextOrSelect(); // 다음 스테이지 또는 선택 화면으로 이동
          }
          break;
      }
      return; // 캐리어 이벤트 중에는 다른 업데이트 로직 건너뛰기
    }

    // 플레이어 이동 처리
    if (!carrierEventActive) {
      handlePlayerMovement(dt);
    }

    // 자동 발사
    if (player.alive) {
      player.fireCd -= dt;
      if (player.fireCd <= 0){
        const bulletSpeed = weaponState.bulletSpeed;
        const bulletImgToUse = bulletImages[weaponState.bulletKey] || defaultBulletImg;

        // 패턴에 따른 총알 발사
        if (weaponState.pattern === 1) {
          spawnPBullet(player.x, player.y - 20, -bulletSpeed, bulletImgToUse);
        } else if (weaponState.pattern === 2) {
          const spreadRad = weaponState.spreadDeg * Math.PI / 180;
          spawnPBullet(player.x - 8, player.y - 20, -bulletSpeed, bulletImgToUse);
          spawnPBullet(player.x + 8, player.y - 20, -bulletSpeed, bulletImgToUse);
        } else if (weaponState.pattern === 3) {
          const spreadRad = weaponState.spreadDeg * Math.PI / 180;
          spawnPBullet(player.x, player.y - 20, -bulletSpeed, bulletImgToUse);
          spawnPBullet(player.x - 12, player.y - 15, -bulletSpeed, bulletImgToUse);
          spawnPBullet(player.x + 12, player.y - 15, -bulletSpeed, bulletImgToUse);
        }
        player.fireCd = weaponState.fireRateMs;
      }
    }

    // 플레이어 탄
    pBullets.arr.forEach(b=>{
      if(!b.active) return;
      b.x += b.vx * dt/1000;
      b.y += b.vy * dt/1000;
      // 화면 밖 즉시 제거
      if (isOffscreen(b.x, b.y, 8)) b.active = false;
   });

    // 적
    enemies.arr.forEach(e=>{
      if(!e.active) return;
      e.t += dt;
      e.x += e.vx * dt/1000;
      e.y += e.vy * dt/1000;
      // 화면 밖 즉시 제거 (위/아래/좌/우 모두)
      if (isOffscreen(e.x, e.y, e.r || 16)) { e.active = false; return; }
      // 간단 패턴: fireInt 주기로 발사
      e.fireT -= dt;
      if (e.fireT<=0){
        enemyFire(e);
        e.fireT = e.fireInt || 900;
      }
    });

    // 보스
    if (boss && boss.active){
      boss.t += dt;
      boss.x += boss.vx*dt/1000;
      boss.y += boss.vy*dt/1000;
      if (boss.y > 120) boss.vy = 0; // 진입 후 정지
      boss.fireT -= dt;
      if (boss.fireT<=0){
        bossFire();
        boss.fireT = boss.fireInt;
      }
      if (boss.hp<=0){
        boss.active=false;
        // 보스 격파 시 상점 오픈
        openShopOnce();
      }
    }

    // 적 탄
    eBullets.arr.forEach(b=>{
      if(!b.active) return;
      b.x += b.vx * dt/1000;
      b.y += b.vy * dt/1000;
      // 화면 밖 즉시 제거
      if (isOffscreen(b.x, b.y, 8)) b.active = false;
    });

    // 충돌
    handleCollisions(dt);

    // 무적/블링크
    if (player.blink>0) player.blink = Math.max(0, player.blink - dt);

    // StageManager 진행
    // console.log('[Game] Calling StageManager.update'); // 너무 자주 호출되므로 주석 처리
    StageManager.update(dt, {
      onTip: showTip,
      onSpawnEnemy: ({x,y,vx,vy,hp,fireInt,pattern})=>{
        spawnEnemy(x,y,vx,vy,hp,fireInt,pattern);
      },
      onSpawnMidBoss: spawnMiniBoss,
      onSpawnBoss: spawnBoss
    });

    // 스테이지 클리어 체크
    if (!stageCleared && canStageClear()){
      triggerStageClear();
    }
  }

  // ====== 적 발사 패턴 ======
  function angleToPlayer(ex,ey){
    const dx = player.x - ex, dy = player.y - ey;
    return Math.atan2(dy, dx);
  }
  function enemyFire(e){
    const p = e.pattern || 'straight';
    // 이지 모드일 때만 스피드 스케일 적용
    const spdScale = isEasy ? EASY_EBULLET_SPEED_SCALE : 1.0;
 
    if (p === 'straight'){
      // 아래로 단발
      const vy = 160 * spdScale;
      spawnEBullet(e.x, e.y+10, 0, vy);
    } else if (p === 'aim'){
      // 플레이어 조준
      const ang = angleToPlayer(e.x, e.y);
      const spd = 180 * spdScale;
      spawnEBullet(e.x, e.y, Math.cos(ang)*spd, Math.sin(ang)*spd);
    } else if (p === 'spread3'){
      // 스프레드3: 이지=2way(좌/우), 노멀/하드=3way
      const base = Math.PI/2; // 아래
      const spd = 160 * spdScale, spread = Math.PI/12;
      const rays = isEasy ? [-1, +1] : [-1, 0, +1];
      for (const i of rays){
        spawnEBullet(e.x, e.y, Math.cos(base + i*spread)*spd, Math.sin(base + i*spread)*spd);
      }
    } else if (p === 'spread5'){
      // 스프레드5: 이지=3way(좌/중/우), 노멀/하드=5way
      const base = Math.PI/2;
      const spd = 170 * spdScale, spread = Math.PI/16;
      const rays = isEasy ? [-1, 0, +1] : [-2, -1, 0, +1, +2];
      for (const i of rays){
        spawnEBullet(e.x, e.y, Math.cos(base + i*spread)*spd, Math.sin(base + i*spread)*spd);
      }
    } else {
      // 알 수 없는 패턴: 안전하게 단발(스케일 적용)
      const vy = 150 * spdScale;
      spawnEBullet(e.x, e.y+10, 0, vy);
    }
  }
  function bossFire(){
    // 간단 라운드 탄막 + 조준 단발 섞기
    const n = 12; const spd = 160;
    for (let i=0;i<n;i++){
      const a = (Math.PI*2) * (i/n);
      spawnEBullet(boss.x, boss.y, Math.cos(a)*spd, Math.sin(a)*spd);
    }
    // 조준
    const ang = angleToPlayer(boss.x, boss.y);
    spawnEBullet(boss.x, boss.y, Math.cos(ang)*220, Math.sin(ang)*220);
  }

  // ====== 충돌 ======
  function hitCircle(ax,ay,ar, bx,by,br){
    const dx=ax-bx, dy=ay-by;
    return (dx*dx + dy*dy) <= (ar+br)*(ar+br);
  }

  function handleCollisions(dt){
    // 플레이어 탄 vs 적
    enemies.arr.forEach(e=>{
      if(!e.active) return;
      for (let i=0;i<pBullets.arr.length;i++){
        const b = pBullets.arr[i];
        if(!b.active) continue;
        if (hitCircle(e.x,e.y,e.r, b.x,b.y,6)){
          b.active=false;
          e.hp -= weaponState.damage;
          if (e.hp<=0){ e.active=false; player.coins += 1; }
          break;
        }
      }
    });

    // 플레이어 탄 vs 보스
    if (boss && boss.active){
      for (let i=0;i<pBullets.arr.length;i++){
        const b = pBullets.arr[i];
        if(!b.active) continue;
        const br = boss.hitR ?? boss.r;
        if (hitCircle(boss.x,boss.y,br, b.x,b.y,6)){
          b.active=false;
          boss.hp -= weaponState.damage;
          if (boss.hp<=0){
            boss.active=false;
            player.coins += 10; // 보스 격파 시 10 코인 획득
            // 보스 격파 시 상점 오픈
            openShopOnce();
          }
        }
      }
    }

    // 적/적탄 vs 플레이어
    if (player.alive && player.blink<=0){
      // 적탄
      for (let i=0;i<eBullets.arr.length;i++){
        const b = eBullets.arr[i];
        if(!b.active) continue;
        if (hitCircle(player.x,player.y,player.r, b.x,b.y,4)){
          b.active=false; damagePlayer();
          break;
        }
      }
      // 적 몸통
      for (let i=0;i<enemies.arr.length;i++){
        const e = enemies.arr[i];
        if(!e.active) continue;
        if (hitCircle(player.x,player.y,player.r, e.x,e.y,e.r)){
          e.active=false; damagePlayer();
          break;
        }
      }
      // 보스 몸통
      if (boss && boss.active && hitCircle(player.x,player.y,player.r, boss.x,boss.y,(boss.hitR ?? boss.r))){
        damagePlayer();
      }
    }
  }

  function damagePlayer(){
  // 🔊 피격 효과음 재생
  try {
    hitSound.currentTime = 0;
    hitSound.play();
  } catch(e) {
    console.warn('hit sound 재생 실패:', e);
  }

  player.hp -= 1;
  player.blink = 1500;

  if (player.hp <= 0 && !isGameOver) {
    player.alive = false;
    isGameOver = true;
    gameOverTime = nowMS();

    // 🔊 게임 오버 효과음
    try {
      gameOverSound.currentTime = 0;
      gameOverSound.play();
    } catch(e) {
      console.warn('game over sound 재생 실패:', e);
    }

    // 약간의 연출 후 화면 전환
    setTimeout(() => {
      if (difficulty === 'easy') location.href='stage_list_easy.html';
      else location.href='stage_list_hard.html';
    }, 2500);
  }
}

  // ====== 스테이지 클리어 판정/연출 ======
  function noneActive(pool){
    for (let i=0;i<pool.arr.length;i++){
      if (pool.arr[i].active) return false;
    }
    return true;
  }
  function isBossGone(){
    return !boss || !boss.active || boss.hp<=0 || boss.y<-100 || boss.y>H+100;
  }
  function canStageClear(){
    // 상점 오픈/일시정지 중이면 클리어 판정 중지
    if (isPaused) return false;
    const scheduleDone = StageManager.isAllScheduled();
    const enemiesGone  = noneActive(enemies);
    const eBulletsGone = noneActive(eBullets);
    return scheduleDone && enemiesGone && eBulletsGone && isBossGone();
  }
  function triggerStageClear(){
    stageCleared = true;
    stageClearTime = nowMS();
    bannerAlpha = 0;
    // 잔여 적탄&적 제거
    eBullets.arr.forEach(b=> b.active=false);
    enemies.arr.forEach(e=> e.active=false);
    if (boss) boss.active=false;
    // ★ 진행도 저장
    saveProgressAfterClear();
    // 게임 진행 상태 저장 (코인 등)
    saveGameProgress();

    // 캐리어 이벤트 시작
    carrierEventActive = true;
    carrierY = -200; // 화면 밖 위에서 시작
    playerAttachedToCarrier = false;
    carrierAnimationPhase = 0;
  }

  function goNextOrSelect(){
    location.href = (difficulty==='easy') ? 'stage_list_easy.html' : 'stage_list_hard.html';
  }
  // ====== 그리기 ======
  function draw(){
    // 배경
    ctx.fillStyle = '#071521';
    ctx.fillRect(0,0,W,H);

    // 캐리어 이벤트 중일 때 캐리어 그리기
    if (carrierEventActive && carrierImg && carrierImg.complete && carrierImg.naturalWidth > 0) {
      const carrierW = carrierImg.naturalWidth;
      const carrierH = carrierImg.naturalHeight;
      ctx.drawImage(carrierImg, W / 2 - carrierW / 2, carrierY - carrierH / 2, carrierW, carrierH);
    }

    // 간단 별 효과
    ctx.fillStyle = '#0d2a3f';
    const t = nowMS()/20|0;
    for(let i=0;i<40;i++){
      const x = (i*53 + t) % W;
      const y = (i*97 + t) % H;
      ctx.fillRect(x,y,2,2);
    }

    // 플레이어
    const blinkOn = (player.blink>0) ? ((nowMS()/80|0)%2===0) : false;
    // 캐리어 이벤트 중에는 깜빡임 효과 무시
    if (player.alive && (!blinkOn || carrierEventActive)){
      ctx.save();
      ctx.globalAlpha = player.opacity; // 플레이어 불투명도 적용
      if (playerImg && playerImg.complete && playerImg.naturalWidth>0){
        const w=64, h=64;
        ctx.drawImage(playerImg, player.x-w/2, player.y-h/2, w, h);
      }else{
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // 플레이어 탄
    if (!carrierEventActive) {
      pBullets.arr.forEach(b=>{
        if(!b.active) return;
        const img = b.img;
        if (img && img.complete && img.naturalWidth>0){
          const w=12,h=24;
          ctx.drawImage(img, b.x-w/2, b.y-h/2, w, h);
        }else{
          ctx.fillStyle = '#a7f3d0';
          ctx.fillRect(b.x-2,b.y-6,4,12);
        }
      });
    }

    // 적
    enemies.arr.forEach(e=>{
      if(!e.active) return;
      const img = e.img;
      if (img && img.complete && img.naturalWidth>0){
        const size = e.r*4; // 확대
        ctx.drawImage(img, e.x-size/2, e.y-size/2, size, size);
      }else{
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
      }
    });

    // 보스
    if (boss && boss.active){
      if (boss.img && boss.img.complete && boss.img.naturalWidth > 0) {
        const w = boss.img.naturalWidth;
        const h = boss.img.naturalHeight;
        ctx.drawImage(boss.img, boss.x - w/2, boss.y - h/2, w, h);
      } else {
        // 이미지가 없을 경우 기존 원형 표시
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(boss.x,boss.y,boss.r,0,Math.PI*2); ctx.stroke();
      }

      // HP 바
      const wBar=200, hBar=8;
      const ratio = clamp(boss.hp/120,0,1);
      ctx.fillStyle='#111827'; ctx.fillRect(W/2-wBar/2, 20, wBar, hBar);
      ctx.fillStyle='#ef4444'; ctx.fillRect(W/2-wBar/2, 20, wBar*ratio, hBar);
      ctx.strokeStyle='#fecaca'; ctx.strokeRect(W/2-wBar/2, 20, wBar, hBar);
    }

    // 적 탄
    if (!carrierEventActive) {
      eBullets.arr.forEach(b=>{
        if(!b.active) return;
        const img = b.img;
        if (img && img.complete && img.naturalWidth>0){
          const w=14,h=14;
          ctx.drawImage(img, b.x-w/2, b.y-h/2, w, h);
        }else{
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(b.x-2,b.y-2,4,4);
        }
      });
    }

    // Tip
    if (nowMS() - tipTime < 1200){
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tipMsg, W/2, 64);
      ctx.restore();
    }

    // STAGE CLEAR 배너
    if (stageCleared){
      const elapsed = nowMS() - stageClearTime;
      bannerAlpha = Math.min(1, elapsed/800);
      ctx.save();
      ctx.globalAlpha = bannerAlpha;
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE CLEAR!', W/2, H/2);
      ctx.restore();


    }

    // GAME OVER 배너
    if (isGameOver) {
      const elapsed = nowMS() - gameOverTime;
      const alpha = Math.min(1, elapsed / 800);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffb4b4';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2);
      ctx.restore();
    }


    // 플레이어 HP 표시(간단)
    ctx.fillStyle='#e5e7eb';
    ctx.font='bold 14px sans-serif';
    ctx.textAlign='left';
    ctx.fillText(`HP: ${Math.max(0,player.hp)}`, 16, H-16);

    // 코인 표시
    const coinHud = document.getElementById('coinHud');
    if (coinHud) {
      coinHud.textContent = `COINS: ${player.coins}`;
    }
  }

  // ====== 메인 루프 ======
  function frame(ts){
    const delta = ts - lastTS;
    lastTS = ts;
    acc += delta;
    // 고정 타임스텝
    while (acc >= FIXED_DT){
      update(FIXED_DT);
      acc -= FIXED_DT;
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ====== 스테이지 초기화 ======
  function initStage(){
    console.log(`[Game] Initializing stage. Difficulty: ${difficulty}, Stage: ${stage}`);
    const def = (StageDefs && StageDefs.STAGES && StageDefs.STAGES[difficulty] && StageDefs.STAGES[difficulty][stage]) || null;
    if (!def){
      console.error(`[Game] Stage definition not found for ${difficulty}-${stage}`);
      alert(`스테이지 정의를 찾을 수 없습니다: ${difficulty}-${stage}`);
      location.href = (difficulty==='easy') ? 'stage_list_easy.html' : 'stage_list_hard.html';
      return;
    }
    console.log('[Game] Stage definition loaded:', def);
    StageManager.init(def);
    console.log('[Game] StageManager initialized.');
  }

  // ====== 이미지 로드 대기 ======
function preloadAllEnemyImages(callback) {
  let loaded = 0;
  const total = enemyImages.length;
  enemyImages.forEach((img, i) => {
    if (img.complete && img.naturalWidth > 0) {
      loaded++;
      if (loaded === total) callback();
    } else {
      img.onload = () => {
        loaded++;
        if (loaded === total) callback();
      };
      img.onerror = () => {
        console.warn(`enemy image load failed: en${i+1}.png, fallback applied`);
        img.src = 'assets/images/enemy/en1.png'; // 기본 대체 이미지
      };
    }
  });
}

// ====== 시작 ======
preloadAllEnemyImages(() => {
  console.log('✅ 모든 몬스터 이미지 로드 완료');
  initStage();
  requestAnimationFrame(frame);
});
})();