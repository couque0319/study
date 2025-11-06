// assets/js/stage_list_hard.js

(function () {
  // 0) 유틸
  const pad2 = (n) => String(n).padStart(2, '0');

  // 1) 스테이지 버튼 자동 생성 (1~10)
  function makeButtons() {
    const grid = document.getElementById('stage-grid');
    if (!grid) return;

    const TOTAL = 10;
    grid.innerHTML = '';
    for (let i = 1; i <= TOTAL; i++) {
      const id = pad2(i);
      const a = document.createElement('a');
      a.className = 'stage-box hard';   // HARD는 하드 전용 색
      a.textContent = `H-${id}`;
      a.dataset.stage = i;             // ⬅️ 잠금 로직에서 사용
      grid.appendChild(a);
    }
  }

  // 2) 진행도 보정
  function applyLocks() {
    const UNLOCK_KEY = 'progress_hard';

    // 로컬스토리지에서 읽고, 유효하지 않으면 1로 고정
    let unlockStage = parseInt(localStorage.getItem(UNLOCK_KEY) || '1', 10);
    if (!Number.isFinite(unlockStage) || unlockStage < 1) {
      unlockStage = 1;
      try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (_) {}
    }

    // 페이지에 있는 모든 스테이지 박스 처리
    const stageButtons = document.querySelectorAll('.stage-box');
    stageButtons.forEach((btn) => {
      const num = parseInt(btn.dataset.stage, 10);

      const isUnlocked = (num <= unlockStage);

      // 시각적 상태 반영
      btn.classList.toggle('locked', !isUnlocked);

      if (isUnlocked) {
        btn.href = `game.html?difficulty=hard&stage=${pad2(num)}`;
        btn.setAttribute('aria-label', `Hard Stage ${pad2(num)} 시작`);
      } else {
        // 잠긴 경우: 이동 막고 토스트 안내
        btn.href = '#';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          showToast(`스테이지 ${pad2(num)}는 아직 잠겨 있습니다. 이전 스테이지를 먼저 클리어하세요!`);
        });
      }
    });
  }

  // 3) 간단 토스트
  function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      Object.assign(t.style, {
        position: 'fixed', left: '50%', bottom: '32px', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '10px 14px',
        borderRadius: '10px', fontFamily: 'system-ui, sans-serif', fontSize: '14px',
        zIndex: 9999, opacity: 0, transition: 'opacity .2s ease'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => (t.style.opacity = '0'), 1400);
  }

  // 실행
  makeButtons();
  applyLocks();
})();