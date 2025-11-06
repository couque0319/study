// assets/js/monsters.js
(function(){
  const NS = (window.MONSTERS = window.MONSTERS || {});

  // ctx: { cvs, state, DIFF_SCALE, IS_EASY, enemySpeed(), enemyFireInterval(),
  //        spawnBullet(), spawnSpread(), spawnSpiral(), spawnLaser(),
  //        angleTo(), spawnEnemyCapped(), makeEnemy(), rand() }
  NS.init = function init(ctx){ NS.ctx = ctx; return NS; };

  const DIAG_OFFSET = Math.PI / 4; // 45°
  function fireStraight(e, p, speedBase = 2.2){
    const { enemySpeed, spawnBullet, angleTo } = NS.ctx;
    const a = angleTo(e.x, e.y, p.x, p.y);
    spawnBullet(e.x, e.y, a, enemySpeed(speedBase), false);
  }
  function fireDiagonal(e, p, speedBase = 2.2){
    const { enemySpeed, spawnBullet, angleTo } = NS.ctx;
    const a = angleTo(e.x, e.y, p.x, p.y);
    spawnBullet(e.x, e.y, a - DIAG_OFFSET, enemySpeed(speedBase), false);
    spawnBullet(e.x, e.y, a + DIAG_OFFSET, enemySpeed(speedBase), false);
  }

  NS.fireStraight = fireStraight;
  NS.fireDiagonal = fireDiagonal;

  NS.attachDefaultFire = function attachDefaultFire(e){
    e.fire = (p)=> fireStraight(e, p, 2.2);
  };

  // 라인 스폰
  NS.lineSpawn = function lineSpawn(n, startX, endX, vy, kind='grunt', stopY=120){
    const { spawnEnemyCapped, makeEnemy, DIFF_SCALE, state } = NS.ctx;
    const step = (endX - startX) / Math.max(1, n-1);
    let idx = 0;
    spawnEnemyCapped((slots)=>{
      const count = Math.min(n, slots);
      for(let i=0;i<count;i++, idx++){
        const e = makeEnemy(startX + idx*step, -20, kind, stopY);
        e.vy = vy * DIFF_SCALE.enemyRate;
        NS.attachDefaultFire(e);
        state.enemies.push(e);
      }
    });
  };

  // 포탑(교차 사격)
  NS.ringTurret = function ringTurret(cx, cy){
    const { makeEnemy, DIFF_SCALE, state } = NS.ctx;
    const e = makeEnemy(cx, cy, 'turret', cy);
    e.vx=0; e.vy=0; e.hp = 5*DIFF_SCALE.enemyHp; e.patternT=0;
    e.update = (p)=>{
      e.patternT++;
      if (e.patternT % 45 === 0){
        e.alt = !e.alt;
        if (e.alt) fireDiagonal(e, p, 2.4);
        else       fireStraight(e, p, 2.8);
      }
    };
    state.enemies.push(e);
  };

  // 사이드 스윕(레이저 보조)
  NS.sideSweep = function sideSweep(stopY=100){
    const { spawnEnemyCapped, makeEnemy, cvs, spawnLaser, state } = NS.ctx;
    spawnEnemyCapped((slots)=>{
      if (slots<=0) return;
      const need = Math.min(2, slots);
      const left  = need>=1 ? makeEnemy(40, 80, cvs.width<480?'grunt':'laser', stopY) : null;
      const right = need>=2 ? makeEnemy(cvs.width-40, 120, cvs.width<480?'grunt':'laser', stopY) : null;
      for (const e of [left, right].filter(Boolean)){
        e.vy=0;
        e.update = (p)=>{
          e.t++;
          if (e.t % 120 === 30){
            const dir = (e.x < cvs.width/2) ? +0.6 : -0.6;
            const a = NS.ctx.angleTo(e.x,e.y, p.x,p.y) + dir;
            const L = spawnLaser(e.x,e.y, a, 80, 36, 6, e);
            e.fire = (pp)=>{ e.alt = !e.alt; if (e.alt) fireDiagonal(e, pp, 2.1); else fireStraight(e, pp, 2.1); };
            L.onTick = (t)=>{ if (t> L.warmup && t%20===0 && e.fire) e.fire(state.player); };
          }
        };
        state.enemies.push(e);
      }
    });
  };

  // 이지 전용: 잡몹 리스폰
  NS.respawnGruntTop = function respawnGruntTop(){
    const { makeEnemy, DIFF_SCALE, state, cvs, rand } = NS.ctx;
    const x = rand(40, cvs.width-40);
    const stopY = 110 + Math.random()*50;
    const e = makeEnemy(x, -20, 'grunt', stopY);
    e.vy = 0.9 * DIFF_SCALE.enemyRate;
    e.fire = (p)=> fireStraight(e, p, 2.2);
    e.update = (p)=>{ if (e.t % 180 === 30){ e.alt = !e.alt; if (e.alt) fireDiagonal(e, p, 2.0); else fireStraight(e, p, 2.0); } };
    state.enemies.push(e);
  };

  NS.DIAG_OFFSET = DIAG_OFFSET;
})();
