// assets/js/hangar.js

// 1. HTML 요소 가져오기
const selectionBoxes = document.querySelectorAll('.airplane-box');

// 2. 현재 저장된 기체 선택 불러오기
// localStorage는 브라우저를 껐다 켜도 유지되는 간단한 저장소입니다.
const savedPlaneId = localStorage.getItem('selectedAirplane');

// 3. 페이지 로드 시, 이전에 선택한 기체가 있으면 .selected 표시하기
if (savedPlaneId) {
    const savedBox = document.querySelector(`.airplane-box[data-plane-id="${savedPlaneId}"]`);
    if (savedBox) {
        savedBox.classList.add('selected');
    }
}

// 4. 각 기체 박스에 클릭 이벤트 추가하기
selectionBoxes.forEach(box => {
    box.addEventListener('click', () => {
        
        // (A) 일단 모든 박스에서 'selected' 클래스 제거
        selectionBoxes.forEach(b => b.classList.remove('selected'));
        
        // (B) 지금 클릭한 박스에만 'selected' 클래스 추가
        box.classList.add('selected');
        
        // (C) 가장 중요: 클릭한 기체의 ID (data-plane-id)를 localStorage에 저장
        const planeId = box.dataset.planeId;
        localStorage.setItem('selectedAirplane', planeId);
        
        console.log(`기체 선택됨: ${planeId}`);
    });
});