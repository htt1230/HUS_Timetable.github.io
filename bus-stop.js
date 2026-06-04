// URLのパラメータ「?id=X」を解析する
const urlParams = new URLSearchParams(window.location.search);
const busStopId = urlParams.get('id') || '0'; // 指定がなければデフォルトで '0'

// 【マスター規定】ご提示いただいた最新の規定
const BUS_STOP_MASTERS = {
    '0': {
        title: "バス発車標 - 北海道科学大学",
        sheet1: "北海道科学大学",
        sheet2: "school",
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "星置駅方面",   dests: ["星置駅"] },
            { name: "宮の沢方面",   dests: ["宮の沢駅"] }
        ]
    },
    '1': {
        title: "バス発車標 - 大学通西",
        sheet1: "大学通西",
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"] }
        ]
    },
    '2': {
        title: "バス発車標 - 前田中央通",
        sheet1: "前田中央通",
        config: [
            { name: "北24条駅方面", dests: ["北２４条駅前"] },
            { name: "手稲駅方面", dests: ["手稲駅北口"] },
            { name: "前田森林方面", dests: ["前田森林公園"] }
        ]
    },
    '3': {
        title: "バス発車標 - 前田6条10丁目",
        sheet1: "前田6条10丁目",
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
    "手85":     { bg: "#4595e6", text: "#232323" },
    "スクール": { bg: "#ffff33", text: "#232323" },

    "麻41"  : { bg: "#d9333f", text: "#ffffff" },
    "43"    : { bg: "#d9333f", text: "#ffffff" },
    "北72"  : { bg: "#d9333f", text: "#ffffff" },
    "宮47"  : { bg: "#d9333f", text: "#ffffff" },
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
    simHour = now.getHours();
    simMin = now.getMinutes();
    
    const slider = document.getElementById('time-slider');
    slider.value = simHour * 60 + simMin;

    slider.addEventListener('input', function() {
        const totalMinutes = parseInt(this.value, 10);
        simHour = Math.floor(totalMinutes / 60);
        simMin = totalMinutes % 60;
        
        updateClockDisplay();
        renderNextBuses();
    });

    updateClockDisplay();
    buildMobileTabs(); // スマホ用タブボタンの自動生成

    try {
        // リクエストURLの動的構築
        const baseUrl = "https://docs.google.com/spreadsheets/d/1FjixtV7RSD3oJ_KskkLw-Pme-5t85rfGqofP2gIRAjg/gviz/tq?tqx=out:json";
        
        // ★【安全対策】sheet2が存在する場合のみ同時読み込み、無ければsheet1のみ処理する自動分岐
        let fetchPromises = [fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet1)}`)];
        if (currentStop.sheet2) {
            fetchPromises.push(fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet2)}`));
        }

        const responses = await Promise.all(fetchPromises);
        const texts = await Promise.all(responses.map(res => res.text()));

        // 1枚目のデータをパース
        const json1 = responseToJson(texts[0]);
        allData = parseSheetData(json1);

        // 2枚目（sheet2）が存在していれば合算マージ
        if (texts[1]) {
            const json2 = responseToJson(texts[1]);
            const data2 = parseSheetData(json2);
            allData = [...allData, ...data2];
        }

        // 全データを時刻順（hとm）で一発ソート
        allData.sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));

        const today = now.getDay();
        if (today === 0) currentDate = '日曜/祝日';
        else if (today === 6) currentDate = '土曜';
        else currentDate = '平日';
        
        document.getElementById('tab-' + currentDate).classList.add('active');

        document.getElementById('loading').style.display = 'none';
        document.getElementById('lcd-board').style.display = 'block';
        document.getElementById('filter-ui').style.display = 'flex';
        document.getElementById('timetable').style.display = 'table';
        
        updateDestDropdown();
        renderTable();
        renderNextBuses();

    } catch (error) {
        document.getElementById('loading').innerText = "通信エラー";
    }
};

// モバイル用タブボタン生成関数
function buildMobileTabs() {
    const mTabs = document.getElementById('mobile-dir-tabs');
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

function updateClockDisplay() {
    const h = String(simHour).padStart(2, '0');
    const m = String(simMin).padStart(2, '0');
    const timeStr = `${h}:${m}`;
    
    document.getElementById('current-clock').innerText = timeStr;
    document.getElementById('slider-time-display').innerText = timeStr;
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
    return parsed; Greenwood
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
    container.innerHTML = '';

    const selectedDest = document.getElementById('dest-select').value;
    let targetData = allData.filter(d => d.date === currentDate);
    if (selectedDest !== 'all') {
        targetData = targetData.filter(d => d.dest === selectedDest);
    }

    const currentTotalMin = simHour * 60 + simMin;

    // 未来のバスのみ（現在時間以降）を抽出
    const upcoming = targetData.filter(bus => {
        const busTotalMin = bus.h * 60 + bus.m;
        return busTotalMin >= currentTotalMin;
    });

    DIRECTION_CONFIG.forEach((dir, index) => {
        // この方面のバスの中で「発車まで120分(2時間)以内」のものだけを最大3件抽出
        const matchBuses = upcoming.filter(bus => {
            const busTotalMin = bus.h * 60 + bus.m;
            const isMatchDest = dir.dests.includes(bus.dest);
            const isWithin120Min = (busTotalMin - currentTotalMin) <= 120;
            return isMatchDest && isWithin120Min;
        }).slice(0, 3);

        // 選択されている方面かどうかに応じて、モバイル版用の非表示クラス（hide）の付け外しを判定
        let columnHtml = `
            <div id="dir-col-${index}" class="bus-column ${index === currentMobileDir ? '' : 'hide'}">
                <div style="text-align:center;">
                    <span class="c-dir-name">${dir.name}</span>
                </div>
        `;

        // 120分以内に対象のバスがない場合は「なし」枠を表示
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
                
                // 備考の有無判定と！マークボタン（シングルクォーテーションのエスケープ処理含む）
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
    document.getElementById('modal-text').innerText = text;
    document.getElementById('bikou-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('bikou-modal').style.display = 'none';
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const selectedDest = document.getElementById('dest-select').value;
    tbody.innerHTML = '';

    let displayData = allData.filter(d => d.date === currentDate);
    if (selectedDest !== 'all') {
        displayData = displayData.filter(d => d.dest === selectedDest);
    }

    if (displayData.length === 0) {
        document.getElementById('timetable').style.display = 'none';
        document.getElementById('no-data').style.display = 'block';
        return;
    }

    document.getElementById('timetable').style.display = 'table';
    document.getElementById('no-data').style.display = 'none';

    displayData.forEach(bus => {
        const minStr = String(bus.m).padStart(2, '0');
        
        // 1. 始発バッジの生成
        const firstBadge = (bus.isFirst == 1) ? '<span class="c-first" style="margin-left: 4px;">始発</span>' : '';
        
        // 2. 備考ボタンの生成
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

// スプレッドシートのレスポンスを共通でJSONにするヘルパー関数
function responseToJson(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return JSON.parse(text.substring(start, end + 1));
}