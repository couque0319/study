// script.js 

const splashScreen = document.querySelector('.splash-screen');
const audio = document.getElementById('intro-music');
let isTransitioning = false;
let isUnmuted = false;

audio.volume = 0.7;

audio.addEventListener('loadeddata', () => {
    console.log('오디오 파일 로드 완료');
});
audio.addEventListener('error', (e) => {
    console.error('오디오 로드 실패:', e);
    console.error('파일 경로를 확인하세요: assets/audio/intro_music.mp3');
});
audio.play().catch(e => {
    console.log("자동재생 대기 중 (사용자 상호작용 필요):", e.message);
});


function goToMain() {
    if (isTransitioning) return;
    isTransitioning = true;
    console.log('goToMain 실행: 화면 및 음악 페이드 아웃 후 페이지 이동');

    // 1. 화면 페이드 아웃
    splashScreen.style.opacity = '0';
    splashScreen.style.transition = 'opacity 1s ease-out';

    // 2. 음악 페이드 아웃 (1초)
    let currentVolume = audio.volume;
    const fadeOutInterval = setInterval(() => {
        if (currentVolume > 0.05) {
            currentVolume -= 0.05;
            audio.volume = Math.max(0, currentVolume);
        } else {
            clearInterval(fadeOutInterval);
            audio.pause();
            audio.currentTime = 0;
        }
    }, 50);

    setTimeout(() => {
        window.location.href = 'main.html'; 
    }, 1000); // 1초(1000ms)는 페이드 아웃 시간과 동일하게 설정
}

function handleInteraction() {
    if (isTransitioning) return;

    if (!isUnmuted) {
        // 첫 번째 상호작용: 음소거 해제 및 재생
        audio.muted = false;
        audio.volume = 0.7;
        
        audio.play()
            .then(() => {
                console.log('음악 재생 시작!');
                isUnmuted = true;
            })
            .catch(e => {
                console.error('재생 실패:', e);
            });
    } else {
        // 두 번째 상호작용: 메인으로 이동
        goToMain();
    }
}

// 이벤트 리스너 
document.addEventListener('keydown', handleInteraction);
document.addEventListener('click', handleInteraction);
document.addEventListener('touchstart', handleInteraction);