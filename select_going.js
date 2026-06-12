const busStopInfo = {
    '0': {
        name: "手稲駅北口",
        direction: ""
    },
    '1': {
        name: "宮の沢駅",
        direction: ""
    },
    '2': {
        name: "星置駅",
        direction: ""
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('bus-stop-title');
    const infoElement = document.getElementById('bus-stop-info');
    const busStops = document.querySelectorAll('.bus-stop');

    let activeStopId = null; // スマホ用：現在「1回目タップ」されているバス停を記憶

    busStops.forEach(stop => {
        const busName = stop.getAttribute('data-name');
        const link = stop.querySelector('a');
        
        // 【Safari対策】本来のURLをJSの中に一時退避させておく
        const originalHref = link.href;

        // スマホ画面の時だけ、aタグからURLを剥奪してSafariの余計なホバー処理を封じる
        if (window.innerWidth <= 600) {
            link.removeAttribute('href'); 
        }

        // -----------------------------
        // 【PC用】マウスが乗ったときの処理
        // -----------------------------
        stop.addEventListener('mouseenter', () => {
            // 画面幅が600pxより大きい（PC版）時のみ動作
            if (busName && window.innerWidth > 600) { 
                titleElement.textContent = `${busName}から出発する`;
                infoElement.textContent = busStopInfo[stop.id].direction;
            }
        });

        // -----------------------------
        // 【スマホ用】タップ（クリック）時の確実な2段制御
        // -----------------------------
        link.addEventListener('click', (e) => {
            // 画面幅が600px以下の時のみ動作
            if (window.innerWidth <= 600) {
                e.preventDefault(); 
                
                if (activeStopId !== stop.id) {
                    // ▼ 1回目のタップ：選択状態にする（ズーム＆テキスト表示）
                    activeStopId = stop.id; 

                    // 他の看板のズームを解除して、今タップしたものをズーム
                    document.querySelectorAll('.bus-stop').forEach(s => s.classList.remove('active-mobile'));
                    stop.classList.add('active-mobile');

                    // テキストを更新
                    if (busName) {
                        titleElement.textContent = `${busName}から出発する`;
                        infoElement.textContent = busStopInfo[stop.id].direction;
                    }
                } else {
                    // ▼ 2回目のタップ：退避させておいたURLを使って、JSで強制的にページ遷移！
                    window.location.href = originalHref; 
                }
            }
        });
    });
});