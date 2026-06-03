document.addEventListener('DOMContentLoaded', () => {
    // 変更対象の h1 要素を取得
    const titleElement = document.getElementById('bus-stop-title');
    // デフォルトのテキストを記憶しておく
    const defaultText = titleElement.textContent;

    // すべてのバス停要素を取得
    const busStops = document.querySelectorAll('.bus-stop');

    busStops.forEach(stop => {
        // HTMLの data-name に書いた名前を取得
        const busName = stop.getAttribute('data-name');

        // マウスが乗ったとき：h1 をバス停名に書き換える
        stop.addEventListener('mouseenter', () => {
            if (busName) {
                titleElement.textContent = `${busName}を見る`;
            }
        });

        // マウスが離れたとき：元の「〇〇バス停を見る」に戻す
        //stop.addEventListener('mouseleave', () => {
        //    titleElement.textContent = defaultText;
        //});
    });
});