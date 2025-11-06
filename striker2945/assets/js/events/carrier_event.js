// assets/js/events/carrier_event.js (전체 코드 교체)
(function (global) {
  const NS = (global.CarrierEvent = global.CarrierEvent || {});
  
  // 메인 게임 씬을 일시 정지/재개하기 위해 이름을 임시로 저장
  // main_game.js에서 사용하는 씬의 이름을 'MainGameScene'이라고 가정합니다.
  const MAIN_SCENE_KEY = 'MainGameScene';
  const MINIGAME_SCENE_KEY = 'MinigameScene';

  // =========================================================================
  // 1. Minigame Scene 정의 (base (1).html의 로직을 여기에 이식해야 합니다)
  // =========================================================================
  class MinigameScene extends Phaser.Scene {
    constructor() {
      super(MINIGAME_SCENE_KEY);
      this.onCompleteCallback = null;
      // base(1).html의 변수들을 여기에 정의
      this.gameOver = false;
      this.score = 0;
      this.scoreText = null;
      // ... 기타 필요한 변수들
    }
    
    // base(1).html의 preload 함수 내용을 여기에 복사
    preload() {
        // base(1).html의 preload 내용 복사
        // 예: this.load.image('ship', 'assets/ship.png');
        // 참고: base(1).html에 있던 더미 텍스처 생성 헬퍼 함수도 여기에 필요할 수 있습니다.
        
        // ★★★ base(1).html의 preload 로직을 복사하세요 ★★★
    }

    // base(1).html의 create 함수 내용을 여기에 복사
    create() {
        // 이전 씬에서 넘어온 콜백 저장
        this.onCompleteCallback = NS.onCompleteCallback;
        
        // base(1).html의 create 내용 복사 (player, enemies, bullets, scoreText 생성)
        // 예: this.player = this.physics.add.image(240, 500, 'ship');
        // 예: this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '16px', fill: '#fff' });
        
        // 충돌 설정도 여기에 복사
        // 예: this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
        // 예: this.physics.add.collider(this.player, this.enemies, this.hitPlayer, null, this);
        
        // 미니 게임 종료 가이드 (스페이스 키를 누르면 종료)
        this.add.text(this.game.config.width / 2, 30, '★★ 미니 게임: SPACE 키로 종료 ★★', { fontSize: '18px', fill: '#ff0' }).setOrigin(0.5);
        this.input.keyboard.once('keydown-SPACE', this.exitMinigame, this);
        
        // ★★★ base(1).html의 create 로직을 복사하세요 ★★★
    }
    
    // base(1).html의 update 함수 내용을 여기에 복사
    update(time, delta) {
        if (this.gameOver) return;
        // base(1).html의 update 내용 복사 (입력 처리, 발사, 적 이동/스폰)
        
        // ★★★ base(1).html의 update 로직을 복사하세요 ★★★
    }
    
    // base(1).html의 충돌/헬퍼 함수를 여기에 복사
    // 예: hitEnemy(bullet, enemy) {}
    // 예: hitPlayer(player, enemy) {}
    // ★★★ base(1).html의 헬퍼 함수들을 복사하세요 ★★★

    // 미니 게임 종료 및 메인 씬 복귀 로직
    exitMinigame() {
        // 미니 게임 씬 정지
        this.scene.stop(MINIGAME_SCENE_KEY);
        
        // 메인 게임 씬 재개
        this.scene.resume(MAIN_SCENE_KEY);
        
        // 메인 게임으로 콜백 전달
        if (this.onCompleteCallback) {
            this.onCompleteCallback();
        }
    }
  }

  // =========================================================================
  // 2. CarrierEvent.start 함수 정의 (씬 관리자)
  // =========================================================================
  NS.start = function start(mainScene, { onComplete } = {}) {
    // onComplete 콜백을 MinigameScene이 접근할 수 있도록 저장
    NS.onCompleteCallback = onComplete;
    
    // 미니 게임 씬이 아직 게임에 추가되지 않았다면 추가합니다.
    if (!mainScene.sys.game.scene.get(MINIGAME_SCENE_KEY)) {
      mainScene.sys.game.scene.add(MINIGAME_SCENE_KEY, MinigameScene);
    }
    
    // ⭐️ 중요: 현재 씬을 일시 정지하고 미니 게임 씬을 시작합니다.
    mainScene.scene.pause();
    mainScene.scene.start(MINIGAME_SCENE_KEY);
  };
  
})(window);