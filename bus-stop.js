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
    // 💡 実時間を取得してセットする処理のみに変更
    updateCurrentTime();

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

        const now = new Date();
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

        // 💡 1分ごとに実時間を追従させて発車標を自動更新するタイマーを始動
        setInterval(function() {
            updateCurrentTime();
            renderNextBuses();
        }, 30000); // 30秒ごとにチェック

    } catch (error) {
        document.getElementById('loading').innerText = "通信エラー";
    }
};

// 💡 現在の実時間を取得して内部変数を書き換えるヘルパー関数
function updateCurrentTime() {
    const now = new Date();
    simHour = now.getHours();
    simMin = now.getMinutes();
    
    const h = String(simHour).padStart(2, '0');
    const m = String(simMin).padStart(2, '0');
    document.getElementById('current-clock').innerText = `${h}:${m}`;
}

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
        document.getElementById('modal-text').innerHTML = text;
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