// main_game.js — Phaser 통일 버전(안정/간결)
// - 플레이어 이동/사격
// - 적 스폰(직선/대각/교차), 탄막(직선/조준/확산)
// - 충돌: 플레이어↔적탄 / 플레이어↔적
// - HP/코인 HUD, 게임오버 처리
(() => {
  const W = 480, H = 720;

  // === URL 파라미터 ===
  const qp = (k, fb=null) => { try { return new URLSearchParams(location.search).get(k) ?? fb; } catch { return fb; } };
  const DIFF = (qp('difficulty','easy')||'easy').toLowerCase(); // 'easy'|'hard'
  const STG  = (qp('stage','01')||'01').toUpperCase();          // '01','02',...
  const IS_EASY = (DIFF === 'easy');

  // === 업그레이드/코인(간단 유지) ===
  const Upg = (window.GameUpgrades = window.GameUpgrades || {
    coins: 0, power: 1, gunShots: 1, maxHP: 3
  });

  // === Phaser Config ===
  const config = {
    type: Phaser.AUTO, parent: 'game-root', width: W, height: H, backgroundColor: '#000',
    physics: { default:'arcade', arcade:{ gravity:{y:0}, debug:false } },
    scene: { preload, create, update }
  };

  let scene, player, enemies, pBullets, eBullets, items;
  let cursors, keys;
  let shootCooldown = 0;
  let meta = { safeMode:false, enemyFire:true, bulletScale:1.0 };

  // ----------------------------------------------------------------
  function preload() {
    scene = this;

    // 이미지(없으면 텍스쳐 생성)
    this.load.image('player', 'assets/images/player1.png');
    for (let i=1;i<=10;i++) this.load.image('enemy'+i, 'assets/images/enemy/en'+i+'.png');
    this.load.image('boss1','assets/images/enemy/boss1.png');
    this.load.image('boss2','assets/images/enemy/boss2.png');

    // 폴백 텍스쳐
    if (!this.textures.exists('tx_enemy'))  this.textures.generate('tx_enemy',  { data:['1111','1111','1111','1111'], pixelWidth:6 });
    if (!this.textures.exists('tx_bullet')) this.textures.generate('tx_bullet', { data:['22','22'], pixelWidth:3 });
    if (!this.textures.exists('tx_player')) this.textures.generate('tx_player', { data:['  0  ',' 000 ','00000',' 000 ','  0  '], pixelWidth:6 });
    if (!this.textures.exists('tx_coin'))   this.textures.generate('tx_coin',   { data:[' 44 ','4444',' 44 '], pixelWidth:4 });

    // 사운드(선택)
    this.load.audio('hit','assets/audio/hit.mp3');
  }

  function create() {
    this.physics.world.setBounds(0,0,W,H);

    // === 그룹/풀 ===
    enemies  = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true });
    pBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true });
    eBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true });
    items    = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true });

    // === 플레이어 ===
    const key = this.textures.exists('player') ? 'player' : 'tx_player';
    player = this.physics.add.image(W*0.5, H-80, key).setDepth(10).setScale(0.06);
    player.setCollideWorldBounds(true);
    player.body.setCircle(8, player.displayWidth*0.5-8, player.displayHeight*0.5-8);
    player.speed = 260;
    player.hp = Math.max(1, Upg.maxHP||3);

    // HUD
    syncHud();

    // 입력
    cursors = this.input.keyboard.createCursorKeys();
    keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');

    // 충돌: 플레이어↔적탄, 플레이어↔적, 플레이어탄↔적
    this.physics.add.overlap(player, eBullets, onHitPlayer, null, this);
    this.physics.add.overlap(player, enemies,  onTouchEnemy, null, this);
    this.physics.add.overlap(pBullets, enemies, onHitEnemy, null, this);

    // 스테이지 매니저 셋업
    StageManager.setup(this, DIFF, STG);

    // 메타/스폰/보스 콜백 주입
    StageManager.onApplyMeta = (m) => {
      meta.safeMode   = !!m.safeMode;
      meta.enemyFire  = (m.enemyFire !== false);
      meta.bulletScale= Number(m.bulletScale || 1.0);
      // 난이도 스케일: easy는 탄속 절반
      if (IS_EASY) meta.bulletScale *= 0.5;
    };

    StageManager.onShowTip = (t) => showTip(t);

    StageManager.onSpawnEnemy = ({ x, y, def, params }) => {
      const k = (def?.imageKey && scene.textures.exists(def.imageKey)) ? def.imageKey : 'tx_enemy';
      const e = enemies.get(x, y, k); if (!e) return null;
      e.setActive(true).setVisible(true).setDepth(5);
      e.setDisplaySize(36, 36);
      e.hp = def?.hp ?? 3;
      e.fireInt = params?.fireInt ?? 1200;
      e.pattern = params?.pattern || 'straight';
      const vy = def?.speedY ?? 70;
      const vx = params?.vx ?? 0;
      e.setVelocity(vx, vy);

      // 개별 업데이트(탄 발사 패턴)
      e._t = 0; e.update = function(time, delta) {
        if (!this.active) return;
        this._t += delta;
        // 화면 밖 제거
        if (this.y > H + 40 || this.x < -40 || this.x > W+40) { this.destroy(); return; }
        if (!meta.enemyFire) return;
        if (this._t >= this.fireInt) {
          this._t = 0;
          firePattern(this, e.pattern);
        }
      };
      return e;
    };

    StageManager.onSpawnBoss = (key='boss1') => {
      const k = (scene.textures.exists(key) ? key : 'tx_enemy');
      const b = enemies.get(W*0.5, -80, k); if (!b) return null;
      b.setActive(true).setVisible(true).setDepth(12).setScale(1.2);
      b.hp = 120; b._t = 0; b.fireInt = 600;
      b.setVelocity(0, 60);
      b.update = function(time, delta) {
        if (!this.active) return;
        if (this.y >= 140) this.setVelocity(0, 0);
        this._t += delta;
        if (meta.enemyFire && this._t > this.fireInt) {
          this._t = 0;
          radialN(this, 12, 150); // 기본 원형탄
          spreadAtPlayer(this, 5, 32, 1.0); // + 스프레드 보조
        }
        if (this.hp <= 0) {
          this.destroy();
          showTip('보스 격파!');
          
          
            player.setActive(false).setVisible(false).setVelocity(0);

            window.CarrierEvent.start(scene, {
               onComplete: () => {
                window.ShopEvent.start(scene, {
                   onExit: () => {
                    location.href = 'select_stage.html';
                   }
                });
               }
            });
            return
          
        }
      };
      return b;
    };

    // 스테이지 시작
    StageManager.start();
    document.getElementById('stageHud').textContent = `Stage ${STG} (${DIFF})`;
  }

  function update(_, dt) {
    if (!player || !player.active) return;
    // 이동
    let vx=0, vy=0;
    if (cursors.left.isDown || keys.A.isDown)  vx -= 1;
    if (cursors.right.isDown|| keys.D.isDown)  vx += 1;
    if (cursors.up.isDown   || keys.W.isDown)  vy -= 1;
    if (cursors.down.isDown || keys.S.isDown)  vy += 1;
    const len = Math.hypot(vx, vy) || 1;
    player.setVelocity((vx/len) * player.speed, (vy/len) * player.speed);

    // 사격
    shootCooldown -= dt;
    const canShoot = Phaser.Input.Keyboard.JustDown(keys.SPACE) || (cursors.space && cursors.space.isDown);
    if (canShoot && shootCooldown <= 0) {
      shootCooldown = 180; // ms
      const n = Math.max(1, Math.min(3, Upg.gunShots || 1));
      for (let i=0;i<n;i++){
        const off = (i - (n-1)/2) * 10;
        spawnPlayerBullet(player.x + off, player.y - 16, -360);
      }
    }

    // 화면 밖 오브젝트 정리
    purgeOffscreen(pBullets, W, H);
    purgeOffscreen(eBullets, W, H, true);
    purgeOffscreen(enemies,  W, H, true);
  }

  // ----------------------------------------------------------------
  // 충돌 처리
  function onHitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.hp = (enemy.hp ?? 1) - Math.max(1, Upg.power);
    if (enemy.hp <= 0) {
      // 코인 드랍(확률)
      if (Math.random() < 0.35) {
        const c = items.get(enemy.x, enemy.y, 'tx_coin');
        if (c) {
          c.setActive(true).setVisible(true).setDepth(9);
          c.body.setCircle(6,0,0);
          c.setVelocity(0, 50);
          scene.physics.add.overlap(player, c, () => {
            Upg.coins += 1; syncHud(); c.destroy();
          });
        }
      }
      enemy.destroy();
    }
  }

  function onTouchEnemy(playerSpr, enemy) {
    applyPlayerDamage('body', enemy);
  }

  function onHitPlayer(playerSpr, bullet) {
    bullet.destroy();
    applyPlayerDamage('bullet', null);
  }

  function applyPlayerDamage(source='bullet', hostile=null) {
    if (meta.safeMode) return;
    if (player.isInvincible) return;

    player.hp = Math.max(0, (player.hp ?? (Upg.maxHP||3)) - 1);
    syncHud();

    // 히트 연출/무적 프레임
    scene.sound?.play?.('hit', { volume: 0.45 });
    navigator.vibrate?.(80);
    player.isInvincible = true;
    scene.tweens.add({
      targets: player, alpha: 0.3, yoyo:true, repeat:6, duration:80,
      onComplete: () => { player.alpha = 1; player.isInvincible = false; }
    });

    // 몸통 충돌 넉백(옵션)
    if (source === 'body' && hostile && hostile.active) {
      const dir = Math.sign(player.x - hostile.x) || 1;
      player.setVelocity(120*dir, -180);
    }

    if (player.hp <= 0) gameOver();
  }

  function gameOver() {
    // 정리
    [pBullets, eBullets, enemies].forEach(g => g.children.iterate(o=> o && o.active && o.destroy()));
    const t = scene.add.text(W/2, H/2, 'GAME OVER', { fontFamily:'ui-monospace,Consolas,monospace', fontSize:'28px', color:'#ffb4b4', stroke:'#000', strokeThickness:4 }).setOrigin(0.5).setDepth(999);
    scene.cameras.main.shake(300, 0.004);
    scene.time.delayedCall(1400, () => { location.href = 'select_stage.html'; });
  }

  // ----------------------------------------------------------------
  // 발사/패턴 유틸
  function spawnPlayerBullet(x, y, vy) {
    const b = pBullets.get(x, y, 'tx_bullet'); if (!b) return;
    b.setActive(true).setVisible(true); b.setVelocity(0, vy); b.body.setCircle(3,0,0);
  }
  function purgeOffscreen(group, W, H, removeBelowOnly=false) {
    group.children.iterate(obj => {
      if (!obj || !obj.active) return;
      if (obj.x < -20 || obj.x > W+20 || obj.y < -40 || obj.y > H+40) {
        if (removeBelowOnly) { if (obj.y > H+40) obj.destroy(); }
        else obj.destroy();
      }
    });
  }
  const aimAngle = (ax,ay,bx,by)=> Math.atan2(by-ay, bx-ax);

  function fireAt(from, to, speed=150) {
    if (!meta.enemyFire) return;
    const b = eBullets.get(from.x, from.y, 'tx_bullet'); if (!b) return;
    const ang = aimAngle(from.x, from.y, to.x, to.y);
    const spd = speed * (meta.bulletScale||1.0);
    b.setActive(true).setVisible(true);
    b.setVelocity(Math.cos(ang)*spd, Math.sin(ang)*spd);
    b.body.setCircle(3,0,0);
  }
  function radialN(from, n=8, speed=140) {
    if (!meta.enemyFire) return;
    const spd = speed * (meta.bulletScale||1.0);
    for (let i=0;i<n;i++){
      const ang = (Math.PI*2)*(i/n);
      const b = eBullets.get(from.x, from.y, 'tx_bullet'); if (!b) continue;
      b.setActive(true).setVisible(true);
      b.setVelocity(Math.cos(ang)*spd, Math.sin(ang)*spd);
      b.body.setCircle(3,0,0);
    }
  }
  function spreadAtPlayer(from, n=3, deg=24, speedMul=1.0) {
    if (!meta.enemyFire) return;
    const base = 140 * speedMul;
    const aim = aimAngle(from.x, from.y, player.x, player.y);
    const step = Phaser.Math.DegToRad(deg);
    const mid = Math.floor(n/2);
    for (let i=0;i<n;i++){
      const off = (i - mid) * step;
      const ang = aim + off;
      const b = eBullets.get(from.x, from.y, 'tx_bullet'); if (!b) continue;
      b.setActive(true).setVisible(true);
      b.setVelocity(Math.cos(ang)*base*(meta.bulletScale||1.0), Math.sin(ang)*base*(meta.bulletScale||1.0));
      b.body.setCircle(3,0,0);
    }
  }

  // 적 개별 패턴 라우팅
  function firePattern(enemy, name) {
    switch (name) {
      case 'straight':
        // 아래로 직선탄
        if (!meta.enemyFire) return;
        const b = eBullets.get(enemy.x, enemy.y, 'tx_bullet'); if (!b) return;
        b.setActive(true).setVisible(true);
        b.setVelocity(0, 120*(meta.bulletScale||1.0));
        b.body.setCircle(3,0,0);
        break;
      case 'aim':
        fireAt(enemy, player, 150);
        break;
      case 'spread3':
        spreadAtPlayer(enemy, 3, 28, 1.0);
        break;
      case 'spread5':
        spreadAtPlayer(enemy, 5, 20, 1.1);
        break;
      default:
        // 기본: 조준탄
        fireAt(enemy, player, 140);
    }
  }

  // HUD 동기화
  function syncHud() {
    const hpHud   = document.getElementById('hpHud');
    const coinHud = document.getElementById('coinHud');
    if (hpHud)   hpHud.textContent   = `HP: ${player ? player.hp : (Upg.maxHP||3)}`;
    if (coinHud) coinHud.textContent = `COINS: ${Upg.coins||0}`;
  }

  // 간단 팝업
  function showTip(text) {
    const t = scene.add.text(W/2, 40, text, { fontFamily:'ui-monospace,Consolas,monospace', fontSize:'16px', color:'#bfe7ff', stroke:'#000', strokeThickness:3 })
      .setOrigin(0.5).setDepth(999).setAlpha(0);
    scene.tweens.add({
      targets:t, alpha:1, y:28, duration:220, ease:'Cubic.easeOut',
      onComplete:()=> scene.time.delayedCall(1800, ()=> scene.tweens.add({targets:t,alpha:0,y:16,duration:240,onComplete:()=>t.destroy()}))
    });
  }

  // 시작!
  new Phaser.Game(config);
})();
