const busStopInfo = {
    '0': {
        name: "北海道科学大学",
        direction: "宮の沢駅、手稲駅北口、星置駅行です。"
    },
    '1': {
        name: "大学通西",
        direction: "手稲駅北口行です。"
    },
    '2': {
        name: "前田中央通",
        direction: "北24条駅、手稲駅北口、前田森林公園行です。"
    },
    '3': {
        name: "前田6条10丁目",
        direction: "宮の沢駅、麻生駅方面、手稲駅北口行です。"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('bus-stop-title');
    const infoElement = document.getElementById('bus-stop-info');
    const busStops = document.querySelectorAll('.bus-stop');

    let activeStopId = null;

    busStops.forEach(stop => {
        const busName = stop.getAttribute('data-name');
        const link = stop.querySelector('a');
        
        // 💡 ここがポイント！本来のURLをJSの中に一時退避させておく
        const originalHref = link.href;

        // 【Safari対策】スマホ画面の時だけ、aタグからURLを剥奪してSafariを騙す
        if (window.innerWidth <= 600) {
            link.removeAttribute('href'); 
        }

        // 【PC用】マウスが乗ったときの処理
        stop.addEventListener('mouseenter', () => {
            if (busName && window.innerWidth > 600) { 
                titleElement.textContent = `${busName}を見る`;
                infoElement.textContent = busStopInfo[stop.id].direction;
            }
        });

        // 【スマホ用】確実な2段タップ制御
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 600) {
                e.preventDefault(); 
                
                if (activeStopId !== stop.id) {
                    // 👆【1回目のタップ】Safariのバグを回避して確実にここが動く！
                    activeStopId = stop.id; 

                    document.querySelectorAll('.bus-stop').forEach(s => s.classList.remove('active-mobile'));
                    stop.classList.add('active-mobile');

                    if (busName) {
                        titleElement.textContent = `${busName}を見る`;
                        infoElement.textContent = busStopInfo[stop.id].direction;
                    }
                } else {
                    // 👆【2回目のタップ】退避させておいたURLを使って、JSの力で強制移動！
                    window.location.href = originalHref; 
                }
            }
        });
    });
});