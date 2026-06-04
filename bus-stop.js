// URLのパラメータ「?id=X」を解析する
const urlParams = new URLSearchParams(window.location.search);
const busStopId = urlParams.get('id') || '0'; // 指定がなければデフォルトで '0'

// 【マスター規定】ご提示いただいた最新の規定
// 【マスター規定】ご提示いただいた最新の規定に mapUrl を追加！
const BUS_STOP_MASTERS = {
    '0': {
        title: "バス発車標 - 北海道科学大学",
        sheet1: "北海道科学大学",
        sheet2: "school",
        mapUrl: "https://maps.app.goo.gl/wS4J1GbedkcmbLpf8", // ★ここを追加（科学大バス停のURL）
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "星置駅方面",   dests: ["星置駅"] },
            { name: "宮の沢方面",   dests: ["宮の沢駅"] }
        ]
    },
    '1': {
        title: "バス発車標 - 大学通西",
        sheet1: "大学通西",
        mapUrl: "https://maps.app.goo.gl/Kd5TTFDJTviUZeGUA", // ★ここを追加（大学通西のURL）
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"] }
        ]
    },
    '2': {
        title: "バス発車標 - 前田中央通",
        sheet1: "前田中央通",
        mapUrl: "https://maps.app.goo.gl/RAWR9t7fngMfSj27A", // ★ここを追加
        config: [
            { name: "北24条駅方面", dests: ["北２４条駅前"] },
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "前田森林方面", dests: ["前田森林公園"] }
        ]
    },
    '3': {
        title: "バス発車標 - 前田6条10丁目",
        sheet1: "前田6条10丁目",
        mapUrl: "https://maps.app.goo.gl/aqJjiw3sopQYFqAj9", // ★ここを追加
        config: [
            { name: "麻生花畔方面", dests: ["地下鉄麻生駅","花畔"] },
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "宮の沢方面", dests: ["宮の沢駅"] }
        ]
    }
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
let currentDate = '平日';

let simHour = 0;
let simMin = 0;
let currentMobileDir = 0; // 初期値は0番目の方面

// 選択されたバス停の方面規定を代入
const DIRECTION_CONFIG = currentStop.config;

window.onload = async function() {
    const now = new Date();

    // 💡 画面要素にバス停名を挿入
    const busStopLabel = document.getElementById('current-bus-stop');
    if (busStopLabel) {
        busStopLabel.innerText = currentStop.sheet1;
    }

    busStopLabel.innerHTML += `<img src="../img/maps_pin.png" alt="地図" style="width: 16px; height: auto; vertical-align: middle; margin-left: 4px;">`;
    
    // ★HTML側にスライダー（#time-slider）があるかチェック
    const slider = document.getElementById('time-slider');

    if (slider) {
        // 【スライダーが存在する場合：シミュレーターモード】
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
        // 【スライダーがない場合：実時間連動モード】
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

        const responses = await Promise.all(fetchPromises);
        const texts = await Promise.all(responses.map(res => res.text()));

        const json1 = responseToJson(texts[0]);
        allData = parseSheetData(json1);

        if (texts[1]) {
            const json2 = responseToJson(texts[1]);
            const data2 = parseSheetData(json2);
            allData = [...allData, ...data2];
        }

        allData.sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));

        const today = now.getDay();
        if (today === 0) currentDate = '日曜/祝日';
        else if (today === 6) currentDate = '土曜';
        else currentDate = '平日';
        
// ... (省略) ...
        document.getElementById('tab-' + currentDate).classList.add('active');

        // 👇👇 ここを書き換え（スケルトンを隠して本物を出す） 👇👇
        const skLcd = document.getElementById('skeleton-lcd');
        if (skLcd) skLcd.style.display = 'none';
        
        const skTable = document.getElementById('skeleton-table');
        if (skTable) skTable.style.display = 'none';

        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';

        document.getElementById('lcd-board').style.display = 'block';
        document.getElementById('filter-ui').style.display = 'flex';
        document.getElementById('timetable').style.display = 'table';
        // 👆👆 ここまで 👆👆
        
        updateDestDropdown();
        renderTable();

    } catch (error) {
        // 👇👇 エラー時もスケルトンを隠してエラー文字を出す 👇👇
        const skLcd = document.getElementById('skeleton-lcd');
        if (skLcd) skLcd.style.display = 'none';
        
        const skTable = document.getElementById('skeleton-table');
        if (skTable) skTable.style.display = 'none';
        
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'block';
            loadingEl.innerText = "通信エラー";
        }
        // 👆👆 ここまで 👆👆
    }
};

// 現在の実時間を取得して内部変数を書き換えるヘルパー関数
// 現在の実時間を取得して内部変数を書き換えるヘルパー関数
function updateCurrentTime() {
    const now = new Date();
    simHour = now.getHours();
    simMin = now.getMinutes();
    
    // ★ h の「.padStart(2, '0')」を削除！
    const h = String(simHour);
    const m = String(simMin).padStart(2, '0');
    
    const clockEl = document.getElementById('current-clock');
    if (clockEl) {
        clockEl.innerText = `${h}:${m}`;
    }
}

function updateClockDisplay() {
    // ★ h の「.padStart(2, '0')」を削除！
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
    
    const currentData = allData.filter(d => d.date === currentDate);
    const uniqueDests = [...new Set(currentData.map(d => d.dest))].filter(d => d !== '');
    
    select.innerHTML = '<option value="all">すべて</option>';
    uniqueDests.forEach(dest => {
        const option = document.createElement('option');
        option.value = dest;
        option.innerText = dest;
        select.appendChild(option);
    });
}

function renderNextBuses() {
    const container = document.getElementById('lcd-entries');
    if (!container) return;
    
    container.innerHTML = '';

    const selectEl = document.getElementById('dest-select');
    const selectedDest = selectEl ? selectEl.value : 'all';
    
    let targetData = allData.filter(d => d.date === currentDate);
    if (selectedDest !== 'all') {
        targetData = targetData.filter(d => d.dest === selectedDest);
    }

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
                const diffMin = (bus.h * 60 + bus.m) - currentTotalMin;
                const minStr = String(bus.m).padStart(2, '0');
                
                const rowClass = rowIndex === 0 ? 'primary' : 'sub-row';
                const firstBadge = (bus.isFirst == 1) ? '<span class="c-first">始発</span>' : '';
                
                const infoBtnHtml = bus.bikou ? `<button class="c-info-btn" onclick="openModal('${bus.bikou.replace(/'/g, "\\'")}')">！</button>` : '';
                
                const routeStyle = getRouteStyle(bus.number);
                const depTimeColor = getDepartureTimeColor(diffMin);

                columnHtml += `
                    <div class="bus-card ${rowClass}">
                        <div class="card-row-1">
                            <span class="c-route" style="${routeStyle}">${bus.number}</span>
                            ${firstBadge}
                            <span class="c-time">${bus.h}:${minStr}</span>
                        </div>
                        <div class="card-row-2">
                            <span class="c-dest">${bus.dest}${infoBtnHtml}</span>
                            <span class="c-countdown">あと<span style="font-size:18px; ${depTimeColor}">${diffMin}分</span></span>
                        </div>
                    </div>
                `;
            });
        }

        columnHtml += `</div>`;
        container.innerHTML += columnHtml;
    });
}

// モーダル制御ロジック
function openModal(text) {
    const modalTextEl = document.getElementById('modal-text');
    const modalEl = document.getElementById('bikou-modal');
    if (modalTextEl && modalEl) {
        modalTextEl.innerHTML = text;
        modalEl.style.display = 'flex';
    }
}

// モーダル閉じるロジック
function closeModal() {
    const modalEl = document.getElementById('bikou-modal');
    if (modalEl) modalEl.style.display = 'none';
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

    if (displayData.length === 0) {
        const timetableEl = document.getElementById('timetable');
        const noDataEl = document.getElementById('no-data');
        if (timetableEl) timetableEl.style.display = 'none';
        if (noDataEl) noDataEl.style.display = 'block';
        return;
    }

    const timetableEl = document.getElementById('timetable');
    const noDataEl = document.getElementById('no-data');
    if (timetableEl) timetableEl.style.display = 'table';
    if (noDataEl) noDataEl.style.display = 'none';

    displayData.forEach(bus => {
        const minStr = String(bus.m).padStart(2, '0');
        
        const firstBadge = (bus.isFirst == 1) ? '<span class="c-first" style="margin-left: 4px;">始発</span>' : '';
        
        const infoBtnHtml = bus.bikou ? `<button class="c-info-btn" style="margin-left: 4px;" onclick="openModal('${bus.bikou.replace(/'/g, "\\'")}')">❕</button>` : '';
        
        const routeStyle = getRouteStyle(bus.number);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="c-route" style="${routeStyle}">${bus.number}</span></td>
            <td style="text-align: center; vertical-align: middle;">
                <span style="display: inline-flex; align-items: center; justify-content: center; gap: 2px;">
                    ${bus.dest}${infoBtnHtml}
                </span>
            </td>
            <td><span class="table-time">${bus.h}:${minStr}</span></td>
            <td>${firstBadge}</td> 
        `;
        tbody.appendChild(tr);
    });
    renderNextBuses();
}

function responseToJson(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return JSON.parse(text.substring(start, end + 1));
}