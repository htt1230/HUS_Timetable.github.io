// URLのパラメータ「?id=X」を解析する
const urlParams = new URLSearchParams(window.location.search);
const busStopId = urlParams.get('id') || '0'; // 指定がなければデフォルトで '0'

// 【マスター規定】
const BUS_STOP_MASTERS = {
    '0': {
        title: "バス発車標 - 北海道科学大学",
        sheet1: "北海道科学大学",
        sheet2: "school",
        mapUrl: "https://maps.app.goo.gl/wS4J1GbedkcmbLpf8", 
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "星置駅方面",   dests: ["星置駅"] },
            { name: "宮の沢方面",   dests: ["宮の沢駅"] }
        ]
    },
    '1': {
        title: "バス発車標 - 大学通西",
        sheet1: "大学通西",
        mapUrl: "https://maps.app.goo.gl/Kd5TTFDJTviUZeGUA",
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"] }
        ]
    },
    '2': {
        title: "バス発車標 - 前田中央通",
        sheet1: "前田中央通",
        mapUrl: "https://maps.app.goo.gl/RAWR9t7fngMfSj27A",
        config: [
            { name: "北24条駅方面", dests: ["北２４条駅前"] },
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "前田森林方面", dests: ["前田森林公園"] }
        ]
    },
    '3': {
        title: "バス発車標 - 前田6条10丁目",
        sheet1: "前田6条10丁目",
        mapUrl: "https://maps.app.goo.gl/aqJjiw3sopQYFqAj9",
        config: [
            { name: "麻生・花畔方面", dests: ["地下鉄麻生駅","花畔"] },
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "宮の沢方面", dests: ["宮の沢駅"] }
        ]
    }
};

// ★ 到着予想を計算するための所要時間（分）定数
const TRAVEL_TIMES = {
    '0': { '循環手48': 16, '手48': 16, '手85': 9 },
    '1': { '循環手48': 10, '手48': 10 },
    '2': { '循環手48': 11, '手48': 11 },
    '3': { '43': 5, '宮74': 5, '麻41': 6, '宮47': 7 }
};

// 現在のIDの設定を取得（未定義のIDなら0番の設定を適用）
const currentStop = BUS_STOP_MASTERS[busStopId] || BUS_STOP_MASTERS['0'];

// ページのタイトルタグをバス停名に動的書き換え
document.title = currentStop.title;

// 系統ごとの背景色と文字色の辞書
const ROUTE_COLORS = {
    "宮79":     { bg: "#ff8c00", text: "#232323" },
    "循環手48": { bg: "#8eed8e", text: "#232323" },
    "手48":     { bg: "#8eed8e", text: "#232323" },
    "手85":     { bg: "#99c4f0ff", text: "#232323" },
    "スクール": { bg: "#ffff33", text: "#232323" },

    "麻41"  : { bg: "#118f01ff", text: "#ffffff" },
    "43"    : { bg: "#d9333f", text: "#ffffff" },
    "北72"  : { bg: "#d9333f", text: "#ffffff" },
    "宮47"  : { bg: "#e94a1a", text: "#ffffff" },
    "宮74"  : { bg: "#80bef7ff", text: "#232323" },
};

const DEP_TIME_CLASSES = [
    { maxMin: 1,  color: "#ff3b30" }, 
    { maxMin: 3,  color: "#ffaa00" }, 
    { maxMin: 10, color: "#009900" }  
];

const DEFAULT_TIME_COLOR = "#8e8e93";
const DEFAULT_ROUTE_COLOR = { bg: "#333333", text: "#ffffff" };

function getRouteStyle(routeNumber) {
    const color = ROUTE_COLORS[routeNumber] || DEFAULT_ROUTE_COLOR;
    if (routeNumber === "循環手48") {
        return `background-color: ${color.bg}; color: ${color.text}; font-size: 13px; padding: 2px 4px;`;
    } else if (routeNumber === "スクール") {
        return `background-color: ${color.bg}; color: ${color.text}; font-size: 14px; padding: 2px 4px;`;
    }
    return `background-color: ${color.bg}; color: ${color.text};`;
}

function getDepartureTimeColor(depmin) {
    for (const range of DEP_TIME_CLASSES) {
        if (depmin <= range.maxMin) return `color: ${range.color};`;
    }
    return `color: ${DEFAULT_TIME_COLOR};`;
}

let allData = [];
let teineData = []; // ★ 手稲駅の元データを格納する変数
let currentDate = '平日';

let simHour = 0;
let simMin = 0;
let currentMobileDir = 0; // 初期値は0番目の方面

// 選択されたバス停の方面規定を代入
const DIRECTION_CONFIG = currentStop.config;

window.onload = async function() {
    const now = new Date();

    // 画面要素にバス停名を挿入
    const busStopLabel = document.getElementById('current-bus-stop');
    if (busStopLabel) {
        busStopLabel.innerText = currentStop.sheet1;
    }

    busStopLabel.innerHTML += `<img src="../img/maps_pin.png" alt="地図" style="width: 16px; height: auto; vertical-align: middle; margin-left: 4px;">`;
    
    // マスターデータの mapUrl を <a> タグのリンク先にセットする
    const busStopLink = document.getElementById('bus-stop-link');
    if (busStopLink && currentStop.mapUrl) {
        busStopLink.href = currentStop.mapUrl;
    }

    // HTML側にスライダー（#time-slider）があるかチェック
    const slider = document.getElementById('time-slider');

    if (slider) {
        // 【シミュレーターモード】
        simHour = now.getHours();
        simMin = now.getMinutes();
        slider.value = simHour * 60 + simMin;

        slider.addEventListener('input', function() {
            const totalMinutes = parseInt(this.value, 10);
            simHour = Math.floor(totalMinutes / 60);
            simMin = totalMinutes % 60;
            
            updateClockDisplay();
            renderNextBuses();
        });
        
        updateClockDisplay();
    } else {
        // 【実時間連動モード】
        updateCurrentTime();
        
        // 30秒ごとに実時間を追いかけるタイマーを起動
        setInterval(function() {
            updateCurrentTime();
            renderNextBuses();
        }, 30000);
    }

    buildMobileTabs(); // スマホ用タブボタンの自動生成

    try {
        // リクエストURLの動的構築
        const baseUrl = "https://docs.google.com/spreadsheets/d/1FjixtV7RSD3oJ_KskkLw-Pme-5t85rfGqofP2gIRAjg/gviz/tq?tqx=out:json";
        
        let fetchPromises = [fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet1)}`)];
        if (currentStop.sheet2) {
            fetchPromises.push(fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet2)}`));
        }
        
        // ★ 手稲駅_元時刻のシートも追加で読み込む
        fetchPromises.push(fetch(`${baseUrl}&sheet=${encodeURIComponent('手稲駅_元時刻')}`));

        const responses = await Promise.all(fetchPromises);
        const texts = await Promise.all(responses.map(res => res.text()));

        const json1 = responseToJson(texts[0]);
        allData = parseSheetData(json1);

        if (currentStop.sheet2) {
            const json2 = responseToJson(texts[1]);
            const data2 = parseSheetData(json2);
            allData = [...allData, ...data2];
            
            const teineJson = responseToJson(texts[2]);
            teineData = parseTeineData(teineJson);
        } else {
            const teineJson = responseToJson(texts[1]);
            teineData = parseTeineData(teineJson);
        }

        allData.sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));

        const today = now.getDay();
        if (today === 0) currentDate = '日曜/祝日';
        else if (today === 6) currentDate = '土曜';
        else currentDate = '平日';
        
        document.getElementById('tab-' + currentDate).classList.add('active');

        // スケルトンを隠して本物を出す
        const skLcd = document.getElementById('skeleton-lcd');
        if (skLcd) skLcd.style.display = 'none';
        
        const skTableWrap = document.getElementById('skeleton-table-wrap');
        if (skTableWrap) skTableWrap.style.display = 'none';

        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';

        document.getElementById('lcd-board').style.display = 'block';
        document.getElementById('filter-ui').style.display = 'flex';
        document.getElementById('timetable-wrap').style.display = 'block';
        
        updateDestDropdown();
        renderTable();
        renderNextBuses();

    } catch (error) {
        // エラー時もスケルトンを隠してエラー文字を出す
        const skLcd = document.getElementById('skeleton-lcd');
        if (skLcd) skLcd.style.display = 'none';
        
        const skTableWrap = document.getElementById('skeleton-table-wrap');
        if (skTableWrap) skTableWrap.style.display = 'none';
        
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'block';
            loadingEl.innerText = "通信エラー";
        }
    }
};

// 現在の実時間を取得して内部変数を書き換えるヘルパー関数
function updateCurrentTime() {
    const now = new Date();
    simHour = now.getHours();
    simMin = now.getMinutes();
    
    const h = String(simHour);
    const m = String(simMin).padStart(2, '0');
    
    const clockEl = document.getElementById('current-clock');
    if (clockEl) {
        clockEl.innerText = `${h}:${m}`;
    }
}

function updateClockDisplay() {
    const h = String(simHour);
    const m = String(simMin).padStart(2, '0');
    const timeStr = `${h}:${m}`;
    
    const clockEl = document.getElementById('current-clock');
    if (clockEl) {
        clockEl.innerText = timeStr;
    }
    
    const sliderDisplay = document.getElementById('slider-time-display');
    if (sliderDisplay) {
        sliderDisplay.innerText = timeStr;
    }
}

// モバイル用タブボタン生成関数
function buildMobileTabs() {
    const mTabs = document.getElementById('mobile-dir-tabs');
    if (!mTabs) return;
    
    mTabs.innerHTML = '';
    DIRECTION_CONFIG.forEach((dir, idx) => {
        mTabs.innerHTML += `
            <b-tab class="${idx === currentMobileDir ? 'active' : ''}" onclick="changeMobileDir(${idx})">
                ${dir.name.replace('方面', '')}
            </b-tab>
        `;
    });
}

// モバイル用タブ切り替え関数
function changeMobileDir(index) {
    currentMobileDir = index;
    document.querySelectorAll('#mobile-dir-tabs b-tab').forEach((tab, idx) => {
        tab.classList.toggle('active', idx === index);
    });
    renderNextBuses();
}

function parseSheetData(json) {
    const rows = json.table.rows;
    let parsed = [];
    rows.forEach(row => {
        const getVal = (col) => (col && col.v !== null) ? col.v : '';
        const depH = getVal(row.c[0]);
        if (depH === 'dep-h') return;

        parsed.push({
            h: parseInt(depH, 10),
            m: parseInt(getVal(row.c[1]), 10),
            dest: getVal(row.c[2]),
            isFirst: getVal(row.c[3]),
            number: getVal(row.c[4]),
            date: getVal(row.c[5]),
            bikou: getVal(row.c[6])
        });
    });
    return parsed;
}

function changeDate(dateType) {
    currentDate = dateType;
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if(tab.getAttribute('onclick').includes(dateType)) tab.classList.add('active');
    });
    updateDestDropdown();
    renderTable();
    renderNextBuses();
}

function updateDestDropdown() {
    const select = document.getElementById('dest-select');
    if (!select) return;
    
    const currentSelected = select.value;
    
    const currentData = allData.filter(d => d.date === currentDate);
    const uniqueDests = [...new Set(currentData.map(d => d.dest))].filter(d => d !== '');
    
    select.innerHTML = '<option value="all">すべて</option>';
    uniqueDests.forEach(dest => {
        const option = document.createElement('option');
        option.value = dest;
        option.innerText = dest;
        select.appendChild(option);
    });

    const hasOption = Array.from(select.options).some(opt => opt.value === currentSelected);
    if (hasOption) {
        select.value = currentSelected;
    } else {
        select.value = 'all';
    }
}

function renderNextBuses() {
    const container = document.getElementById('lcd-entries');
    if (!container) return;
    
    container.innerHTML = '';

    let targetData = allData.filter(d => d.date === currentDate);
    const currentTotalMin = simHour * 60 + simMin;

    const upcoming = targetData.filter(bus => {
        const busTotalMin = bus.h * 60 + bus.m;
        return busTotalMin >= currentTotalMin;
    });

    DIRECTION_CONFIG.forEach((dir, index) => {
        const matchBuses = upcoming.filter(bus => {
            const busTotalMin = bus.h * 60 + bus.m;
            const isMatchDest = dir.dests.includes(bus.dest);
            const isWithin450Min = (busTotalMin - currentTotalMin) <= 450;
            return isMatchDest && isWithin450Min;
        }).slice(0, 3);

        let columnHtml = `
            <div id="dir-col-${index}" class="bus-column ${index === currentMobileDir ? '' : 'hide'}">
                <div style="text-align:center;">
                    <span class="c-dir-name">${dir.name}</span>
                </div>
        `;

        if (matchBuses.length === 0) {
            columnHtml += `
                <div class="bus-card" style="display: flex; justify-content: center; align-items: center; text-align: center;">
                    <span style="font-size: 14px; color: #aaa; font-weight: bold;">直近のバスはありません</span>
                </div>
            `;
        } else {
            matchBuses.forEach((bus, rowIndex) => {
                // 💡 安全のために bus のシリアライズ（文字列化）をループ内の最上部に移動
                const busJson = encodeURIComponent(JSON.stringify(bus)).replace(/'/g, "%27");

                const diffMin = (bus.h * 60 + bus.m) - currentTotalMin;
                const minStr = String(bus.m).padStart(2, '0');
                
                const rowClass = rowIndex === 0 ? 'primary' : 'sub-row';
                const firstBadge = (bus.isFirst == 1) ? '<span class="c-first">始発</span>' : '';
                
                // ⭕️ 精巧に作られたデザインの「！」マークを組み込み
                const infoIconHtml = bus.bikou ? `<span class="c-info-btn" style="display:inline-flex; align-items:center; justify-content:center; margin-left:4px; vertical-align:middle;">！</span>` : '';
                
                const routeStyle = getRouteStyle(bus.number);
                const depTimeColor = getDepartureTimeColor(diffMin);

                columnHtml += `
                    <div class="bus-card ${rowClass}" onclick="openBusModal('${busJson}')" style="cursor: pointer;">
                        <div class="card-row-1">
                            <span class="c-route" style="${routeStyle}">${bus.number}</span>
                            ${firstBadge}
                            <span class="c-time">${bus.h}:${minStr}</span>
                        </div>
                        <div class="card-row-2">
                            <span class="c-dest">${bus.dest}${infoIconHtml}</span>
                            <span class="c-countdown">あと<span style="font-size:18px; ${depTimeColor}">${diffMin}分</span></span>
                        </div>
                    </div>
                `;
            });
        }

        if (busStopId === '0' && index === 0) {
            columnHtml += `
                <a href="?id=1" style="text-decoration: none;">
                    <div class="bus-card" style="background-color: #ebebebff; border: 2px solid #9c9a98ff; display: flex; justify-content: center; align-items: center; height: 40px; margin-top: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
                        <span style="font-size: 16px; color: #232323; font-weight: bold;">乗り遅れた？</span>
                    </div>
                </a>
            `;
        }

        columnHtml += `</div>`;
        container.innerHTML += columnHtml;
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    
    const selectEl = document.getElementById('dest-select');
    const selectedDest = selectEl ? selectEl.value : 'all';
    
    tbody.innerHTML = '';

    let displayData = allData.filter(d => d.date === currentDate);
    if (selectedDest !== 'all') {
        displayData = displayData.filter(d => d.dest === selectedDest);
    }

    const timetableWrapEl = document.getElementById('timetable-wrap');
    const noDataEl = document.getElementById('no-data');

    if (displayData.length === 0) {
        if (timetableWrapEl) timetableWrapEl.style.display = 'none';
        if (noDataEl) noDataEl.style.display = 'block';
        return;
    }

    if (timetableWrapEl) timetableWrapEl.style.display = 'block';
    if (noDataEl) noDataEl.style.display = 'none';

    const currentTotalMin = simHour * 60 + simMin;
    let closestRowEl = null;      
    let minDiff = Infinity;       

    displayData.forEach(bus => {
        const busJson = encodeURIComponent(JSON.stringify(bus)).replace(/'/g, "%27"); // 最上部で定義

        const minStr = String(bus.m).padStart(2, '0');
        const firstBadge = (bus.isFirst == 1) ? '<span class="c-first" style="margin-left: 4px;">始発</span>' : '';
        
        // ⭕️ 見た目を統一
        const infoIconHtml = bus.bikou ? `<span class="c-info-btn" style="display:inline-flex; align-items:center; justify-content:center; margin-left:4px; vertical-align:middle;">！</span>` : '';
        const routeStyle = getRouteStyle(bus.number);

        const tr = document.createElement('tr');
        
        const busTotalMin = bus.h * 60 + bus.m;
        const diff = busTotalMin - currentTotalMin;

        if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            closestRowEl = tr; 
        }

        tr.style.cursor = 'pointer';
        tr.onclick = () => openBusModal(busJson);

        tr.innerHTML = `
            <td><span class="c-route" style="${routeStyle}">${bus.number}</span></td>
            <td style="text-align: center; vertical-align: middle;">
                <span style="display: inline-flex; align-items: center; justify-content: center; gap: 2px;">
                    ${bus.dest}${infoIconHtml}
                </span>
            </td>
            <td><span class="table-time">${bus.h}:${minStr}</span></td>
            <td>${firstBadge}</td> 
        `;
        tbody.appendChild(tr);
    });

    if (closestRowEl) {
        closestRowEl.classList.add('current-bus-row');

        setTimeout(() => {
            closestRowEl.scrollIntoView({
                behavior: 'smooth', 
                block: 'start'     
            });
        }, 100);
    }
}
// ★ 新しいモーダル制御ロジック
// ★ モーダル制御ロジック
// ★ モーダル制御ロジック
function openBusModal(encodedBus) {
    const bus = JSON.parse(decodeURIComponent(encodedBus));
    const minStr = String(bus.m).padStart(2, '0');
    const routeStyle = getRouteStyle(bus.number);
    
    let etaHtml = '';
    let trainTransferHtml = '';

    // 手稲駅北口行きの場合のみ、到着予想と乗換案内を計算
    if (bus.dest === "手稲駅北口") {
        const baseTravelTime = (TRAVEL_TIMES[busStopId] && TRAVEL_TIMES[busStopId][bus.number]) ? TRAVEL_TIMES[busStopId][bus.number] : null;
        
        if (baseTravelTime) {
            // 到着予想（分換算）
            const estTotalMin = bus.h * 60 + bus.m + baseTravelTime;
            const arrTime = `${Math.floor(estTotalMin / 60) % 24}:${String(estTotalMin % 60).padStart(2, '0')}`;
            
            etaHtml = `
                <div style="text-align: left; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
                    <span style="color: #666;">到着予想 <span style="font-size:12px;">(手稲駅)</span></span>
                    <span style="float: right; font-weight: bold; font-size: 20px; color: #d9333f;">${arrTime}</span>
                </div>
            `;

            // 👇👇 JR乗り換え案内の自動生成 👇👇
            // 到着から「5分後」以降の電車を調べる（乗り換え猶予）
            const transferLimitMin = estTotalMin + 5; 

            // 小樽方面の行先リスト（これ以外はすべて「札幌方面」として扱う）
            const OTARU_DESTS = ["小樽", "ほしみ", "倶知安", "余市", "然別", "小樽築港", "星置", "銭函"];

            // 取得済みのJRデータから、時間に間に合うものを絞り込み
            const upcomingTrains = teineData.filter(t => (t.h * 60 + t.m) >= transferLimitMin);
            
            // 方面別に分けて、直近の2本だけ取得
            const sapporoTrains = upcomingTrains.filter(t => !OTARU_DESTS.includes(t.dest)).slice(0, 2);
            const otaruTrains = upcomingTrains.filter(t => OTARU_DESTS.includes(t.dest)).slice(0, 2);

            // 電車の種別ごとにバッジの色を変える関数
            const getTrainColor = (type) => {
                if (type.includes("エアポート")) return "#d9333f"; // 赤
                if (type.includes("ニセコ") || type.includes("ライナー")) return "#ff8c00"; // オレンジ
                if (type.includes("区間快速")) return "#009900"; // 緑
                return "#666"; // 普通はグレー
            };

            // 列の中身（電車一覧）を生成する関数
            const generateTrainHtml = (trains, emptyMsg) => {
                if (trains.length === 0) return `<div style="font-size: 12px; color: #999; margin-top: 10px;">${emptyMsg}</div>`;
                return trains.map(t => {
                    const c = getTrainColor(t.route);
                    const tTime = `${t.h}:${String(t.m).padStart(2, '0')}`;
                    return `
                        <div style="margin-bottom: 6px; line-height: 1.3;">
                            <span style="color: ${c}; font-weight: bold; font-size: 10px; border: 1px solid ${c}; padding: 1px 3px; border-radius: 2px;">${t.route}</span><br>
                            <span style="font-size: 12px;">${t.dest}</span> <span style="float: right; font-weight: bold; font-size: 14px;">${tTime}</span>
                        </div>
                    `;
                }).join('');
            };

            trainTransferHtml = `
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #232323; text-align: center;">JR手稲駅 乗換案内</div>
                    <div style="display: flex; justify-content: space-between; gap: 8px; text-align: left;">
                        
                        <div style="flex: 1; background: #f0f8ff; border: 1px solid #cce0ff; padding: 6px; border-radius: 4px;">
                            <div style="font-size: 12px; font-weight: bold; border-bottom: 1px solid #a8cfff; margin-bottom: 6px; padding-bottom: 2px; color: #0056b3; text-align: center;">札幌方面</div>
                            ${generateTrainHtml(sapporoTrains, "本日の運行終了")}
                        </div>

                        <div style="flex: 1; background: #fcfcfc; border: 1px solid #ddd; padding: 6px; border-radius: 4px;">
                            <div style="font-size: 12px; font-weight: bold; border-bottom: 1px solid #ccc; margin-bottom: 6px; padding-bottom: 2px; color: #333; text-align: center;">小樽方面</div>
                            ${generateTrainHtml(otaruTrains, "本日の運行終了")}
                        </div>
                        
                    </div>
                </div>
            `;
        }
    }

const html = `
        <div style="position: relative; text-align: center; margin-bottom: 15px;">
            <span style="${routeStyle} display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 20px;">${bus.number}</span>
            
            <button onclick="closeModal()" style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 22px; color: #888; cursor: pointer; padding: 0;">✕</button>
        </div>
        
        <div style="text-align: left; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
            <span style="color: #666;">行先</span>
            <span style="float: right; font-weight: bold; font-size: 18px;">${bus.dest}</span>
        </div>
        
        <div style="text-align: left; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
            <span style="color: #666;">発車時刻</span>
            <span style="float: right; font-weight: bold; font-size: 20px;">${bus.h}:${minStr}</span>
        </div>
        
        ${etaHtml}
        
        ${bus.bikou ? `
        <div style="text-align: left; font-size: 14px; margin-top: 10px; background: #f9f9f9; padding: 10px; border-radius: 6px; color: #444; line-height: 1.4;">
            <b style="color:#dd3333;">❕ 備考:</b><br>${bus.bikou}
        </div>` : ''}
        
        ${trainTransferHtml}
    `;
    
    const modalTextEl = document.getElementById('modal-text');
    const modalEl = document.getElementById('bikou-modal');
    if (modalTextEl && modalEl) {
        modalTextEl.innerHTML = html;
        modalEl.style.display = 'flex';
    }
}
function closeModal() {
    const modalEl = document.getElementById('bikou-modal');
    if (modalEl) modalEl.style.display = 'none';
}

function responseToJson(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return JSON.parse(text.substring(start, end + 1));
}

// ★ 手稲駅_元時刻シート専用のパーサー
// ★ 手稲駅_元時刻シート専用のパーサー
// ★ 手稲駅_元時刻シート専用のパーサー（J列の方面データ連動版）
function parseTeineData(json) {
    if (!json || !json.table || !json.table.rows) return [];
    const rows = json.table.rows;
    let parsed = [];
    
    rows.forEach(row => {
        const getVal = (col) => (col && col.v !== null) ? col.v : '';
        
        // 列B: 表示時刻
        const timeCol = row.c[1];
        let timeStr = "";
        if (timeCol) {
            if (timeCol.f) timeStr = timeCol.f; 
            else if (Array.isArray(timeCol.v)) timeStr = `${timeCol.v[0]}:${timeCol.v[1]}`; 
            else timeStr = String(timeCol.v);
        }
        
        // 列F (インデックス5): 種別
        const route = String(getVal(row.c[5]));   
        
        // 列G (インデックス6): 行先
        const dest = String(getVal(row.c[6]));    

        // 💡 列J (インデックス9): 方面（札幌・岩見沢方面 / 小樽方面）
        const directionStr = String(getVal(row.c[9]));

        let h = null, m = null;
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            h = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
        }

        if (h !== null && !isNaN(h) && m !== null && !isNaN(m) && route && dest) {
            // 💡 J列の文字列に「小樽」が含まれているかで自動判定
            const isOtaruDirection = directionStr.includes("小樽");

            parsed.push({ 
                h, 
                m, 
                route, 
                dest, 
                isOtaruDirection // 判定結果（true / false）をオブジェクトに持たせる
            });
        }
    });
    
    // 時間順にソート
    parsed.sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));
    return parsed;
}