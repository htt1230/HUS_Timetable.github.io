// URLのパラメータ「?id=X」を解析する
const urlParams = new URLSearchParams(window.location.search);
const busStopId = urlParams.get('id') || '0'; // 指定がなければデフォルトで '0'

// 【マスター規定】
// 【マスター規定】系統（keitou）の条件指定バージョン
const BUS_STOP_MASTERS = {
    '0': {
        title: "バス発車標 - 北海道科学大学",
        sheet1: "北海道科学大学",
        sheet2: "school",
        mapUrl: "https://maps.app.goo.gl/wS4J1GbedkcmbLpf8", 
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"], keitou: ["手48", "循環手48", "手85"] },
            { name: "星置駅方面",   dests: ["星置駅"] },
            { name: "宮の沢方面",   dests: ["宮の沢駅"] }
        ]
    },
    '1': {
        title: "バス発車標 - 大学通西",
        sheet1: "大学通西",
        mapUrl: "https://maps.app.goo.gl/Kd5TTFDJTviUZeGUA",
        config: [
            { name: "手稲駅方面", dests: ["手稲駅北口"], keitou: ["手48", "循環手48"] }
        ]
    },
    '2': {
        title: "バス発車標 - 前田中央通",
        sheet1: "前田中央通",
        mapUrl: "https://maps.app.goo.gl/RAWR9t7fngMfSj27A",
        config: [
            { name: "北24条駅方面", dests: ["北２４条駅前"] },
            { name: "手稲駅方面", dests: ["手稲駅北口"], keitou: ["手48", "循環手48"] },
            { name: "前田森林方面", dests: ["前田森林公園"] }
        ]
    },
    '3': {
        title: "バス発車標 - 前田6条10丁目",
        sheet1: "前田6条10丁目",
        mapUrl: "https://maps.app.goo.gl/aqJjiw3sopQYFqAj9",
        config: [
            { name: "麻生・花畔方面", dests: ["地下鉄麻生駅","花畔"] },
            { name: "手稲駅方面", dests: ["手稲駅北口"], keitou: ["43", "宮47", "麻41", "宮74"] },
            { name: "宮の沢方面",   dests: ["宮の沢駅"],   keitou: ["宮47"] } // 🔥 ここに「宮47」だけを指定することで宮74を排除！
        ]
    }
};

// 到着予想を計算するための所要時間（分）定数
const TRAVEL_TIMES = {
    '0': { '循環手48': 16, '手48': 16, '手85': 9 },
    '1': { '循環手48': 10, '手48': 10 },
    '2': { '循環手48': 11, '手48': 11 },
    '3': { '43': 5, '宮74': 5, '麻41': 6, '宮47': 7 }
};

// 現在の設定を取得
const currentStop = BUS_STOP_MASTERS[busStopId] || BUS_STOP_MASTERS['0'];
document.title = currentStop.title;

// 系統ごとの背景色と文字色
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
let teineData = []; // 手稲駅の現時刻データを格納する配列
let currentDate = '平日';

let simHour = 0;
let simMin = 0;
let currentMobileDir = 0;

const DIRECTION_CONFIG = currentStop.config;

window.onload = async function() {
    const now = new Date();

    const busStopLabel = document.getElementById('current-bus-stop');
    if (busStopLabel) {
        busStopLabel.innerText = currentStop.sheet1;
    }
    busStopLabel.innerHTML += `<img src="../img/maps_pin.png" alt="地図" style="width: 16px; height: auto; vertical-align: middle; margin-left: 4px;">`;
    
    const busStopLink = document.getElementById('bus-stop-link');
    if (busStopLink && currentStop.mapUrl) {
        busStopLink.href = currentStop.mapUrl;
    }

    const slider = document.getElementById('time-slider');
    if (slider) {
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
        updateCurrentTime();
        setInterval(function() {
            updateCurrentTime();
            renderNextBuses();
        }, 30000);
    }

    buildMobileTabs();
try {
        const baseUrl = "https://docs.google.com/spreadsheets/d/1FjixtV7RSD3oJ_KskkLw-Pme-5t85rfGqofP2gIRAjg/gviz/tq?tqx=out:json";
        
        let fetchPromises = [fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet1)}`)];
        if (currentStop.sheet2) {
            fetchPromises.push(fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet2)}`));
        }
        
        // 💡 【修正】「元時刻」と「現時刻」の2つのシートを両方とも配列に追加して同時に叩く
        fetchPromises.push(fetch(`${baseUrl}&sheet=${encodeURIComponent('手稲駅_元時刻')}`));
        fetchPromises.push(fetch(`${baseUrl}&sheet=${encodeURIComponent('手稲駅_現時刻')}`));

        const responses = await Promise.all(fetchPromises);
        const texts = await Promise.all(responses.map(res => res.text()));

        const json1 = responseToJson(texts[0]);
        allData = parseSheetData(json1);

        // 💡 【修正】sheet2（スクール等）の有無によってインデックスをずらして正確にパース
        let teineMotoJson, teineGenJson;
        if (currentStop.sheet2) {
            const json2 = responseToJson(texts[1]);
            const data2 = parseSheetData(json2);
            allData = [...allData, ...data2];
            
            teineMotoJson = responseToJson(texts[2]);
            teineGenJson = responseToJson(texts[3]);
        } else {
            teineMotoJson = responseToJson(texts[1]);
            teineGenJson = responseToJson(texts[2]);
        }

        // 💡 【修正】元時刻と現時刻のデータを合体させる関数へ2つのJSONを渡す
        teineData = parseTeineAndLiveData(teineMotoJson, teineGenJson);

        allData.sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));

        const today = now.getDay();
        if (today === 0) currentDate = '日曜/祝日';
        else if (today === 6) currentDate = '土曜';
        else currentDate = '平日';
        
        document.getElementById('tab-' + currentDate).classList.add('active');

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

function updateCurrentTime() {
    const now = new Date();
    simHour = now.getHours();
    simMin = now.getMinutes();
    const h = String(simHour);
    const m = String(simMin).padStart(2, '0');
    const clockEl = document.getElementById('current-clock');
    if (clockEl) clockEl.innerText = `${h}:${m}`;
}

function updateClockDisplay() {
    const h = String(simHour);
    const m = String(simMin).padStart(2, '0');
    const timeStr = `${h}:${m}`;
    const clockEl = document.getElementById('current-clock');
    if (clockEl) clockEl.innerText = timeStr;
    const sliderDisplay = document.getElementById('slider-time-display');
    if (sliderDisplay) sliderDisplay.innerText = timeStr;
}

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
    if (hasOption) select.value = currentSelected;
    else select.value = 'all';
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
                const busJson = encodeURIComponent(JSON.stringify(bus)).replace(/'/g, "%27");
                const diffMin = (bus.h * 60 + bus.m) - currentTotalMin;
                const minStr = String(bus.m).padStart(2, '0');
                
                const rowClass = rowIndex === 0 ? 'primary' : 'sub-row';
                const firstBadge = (bus.isFirst == 1) ? '<span class="c-first">始発</span>' : '';
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
        const busJson = encodeURIComponent(JSON.stringify(bus)).replace(/'/g, "%27");
        const minStr = String(bus.m).padStart(2, '0');
        const firstBadge = (bus.isFirst == 1) ? '<span class="c-first" style="margin-left: 4px;">始発</span>' : '';
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
            closestRowEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

// ★ モーダル制御ロジック
// ★ モーダル制御ロジック（マスターの keitou 配列連動バージョン）
function openBusModal(encodedBus) {
    const bus = JSON.parse(decodeURIComponent(encodedBus));
    const minStr = String(bus.m).padStart(2, '0');
    const routeStyle = getRouteStyle(bus.number);
    
    let etaHtml = '';
    let trainTransferHtml = '';

    // 💡 現在選択されているバス停の設定から、このバスの行先が属する方面の設定を取得
    const targetConfig = DIRECTION_CONFIG.find(dir => dir.dests.includes(bus.dest));
    
    // 💡 設定が存在し、かつ keitou 配列の中にタップしたバスの系統番号（bus.number）が含まれているか判定
    const isJrTarget = targetConfig && 
                       Array.isArray(targetConfig.keitou) && 
                       targetConfig.keitou.includes(bus.number);

    // 条件に完全一致したバス（手稲駅北口行き、または手稲駅を経由する宮47など）のみJR案内を生成
    if (isJrTarget) {
        const baseTravelTime = (TRAVEL_TIMES[busStopId] && TRAVEL_TIMES[busStopId][bus.number]) ? TRAVEL_TIMES[busStopId][bus.number] : null;
        
        if (baseTravelTime) {
            const estTotalMin = bus.h * 60 + bus.m + baseTravelTime;
            const arrTime = `${Math.floor(estTotalMin / 60) % 24}:${String(estTotalMin % 60).padStart(2, '0')}`;
            
            etaHtml = `
                <div style="text-align: left; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
                    <span style="color: #666;">到着予想 <span style="font-size:12px;">(手稲駅)</span></span>
                    <span style="float: right; font-weight: bold; font-size: 20px; color: #d9333f;">${arrTime}</span>
                </div>
            `;

            const transferLimitMin = estTotalMin + 5; 
            const upcomingTrains = teineData.filter(t => (t.h * 60 + t.m) >= transferLimitMin);
            
            const sapporoTrains = upcomingTrains.filter(t => !t.isOtaruDirection).slice(0, 4);
            const otaruTrains = upcomingTrains.filter(t => t.isOtaruDirection).slice(0, 4);

            const getTrainColor = (type) => {
                if (type.includes("特別快速")) return "#d9333f"; 
                if (type.includes("快速") || type.includes("ライナー")) return "#ff8c00"; 
                return "#232323"; 
            };

const generateTrainHtml = (trains, emptyMsg) => {
                if (trains.length === 0) return `<div style="font-size: 12px; color: #999; margin: 15px 0; text-align: center;">${emptyMsg}</div>`;
                
                // 💡 見出しテーブル：border: none; と border-collapse: collapse; を追加
                const headerHtml = `
                    <table style="width: 100%; margin-bottom: 4px; table-layout: fixed; border-collapse: collapse; border: none; border-bottom: 1px solid #ddd;">
                        <tr>
                            <td style="padding: 2px 0; font-size: 11px; color: #666; text-align: center; width: 20%; border: none;">種別</td>
                            <td style="padding: 2px 0 2px 4px; font-size: 11px; color: #666; text-align: left; border: none;">行先</td>
                            <td style="padding: 2px 0; font-size: 11px; color: #666; text-align: right; width: 20%; border: none;">定刻</td>
                            <td style="padding: 2px 0 2px 6px; font-size: 11px; color: #666; text-align: right; width: 20%; border: none;">運行状況</td>
                        </tr>
                    </table>
                `;

                return headerHtml + trains.map(t => {
                    const c = getTrainColor(t.route);
                    const tTime = `${t.h}:${String(t.m).padStart(2, '0')}`;

                    let displayRoute = t.route;
                    if (t.route.includes("ライナー") || t.route.includes("ﾗｲﾅｰ")) {
                        displayRoute = "ﾗｲﾅｰ";
                    }else if (t.route.includes("特別快速")) {
                        displayRoute = "特快";
                    }

                    let timeStyle = "font-weight: bold; font-size: 18px; color: #232323;";
                    let delayHtml = `<span style="font-size: 16px; color: #186318ff; font-weight: bold;">定刻</span>`;

                    if (t.delay > 0) {
                        timeStyle = "font-size: 16px; color: #888; text-decoration: line-through;";
                        const delayedTotalMin = t.h * 60 + t.m + t.delay;
                        const delayedH = Math.floor(delayedTotalMin / 60) % 24;
                        const delayedM = String(delayedTotalMin % 60).padStart(2, '0');
                        
                        delayHtml = `
                            <span style="font-weight: bold; font-size: 18px; color: #d9333f; margin-right: 4px;">${delayedH}:${delayedM}</span>
                        `;
                    }

                    // 💡 データテーブル：ここも同じく border-collapse: collapse; border: none; を追加
                    // 各 <td> にもデフォルトのボーダーを消すために border: none; を付与
                    return `    
                        <table style="width: 100%; margin-bottom: 6px; table-layout: fixed; border-collapse: collapse; border: none;">
                            <tr>
                                <td style="padding: 4px 0; vertical-align: middle; width: 20%; border: none;">
                                    <span style="color: ${c}; background: #ffffff; font-size: 15px; padding: 1px 4px; border: 1px solid ${c}; border-radius: 3px; display: inline-block; white-space: nowrap;">${displayRoute}</span>
                                </td>
                                <td style="padding: 4px 0 4px 4px; vertical-align: middle; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; border: none;">
                                    <span style="color: #232323; font-size: 16px; font-weight: bold;">${t.dest}行</span>
                                </td>
                                <td style="padding: 4px 0 4px 4px; vertical-align: middle; text-align: right; width: 20%; border: none;">
                                    <span style="${timeStyle}">${tTime}</span>
                                </td>
                                <td style="padding: 4px 0 4px 6px; vertical-align: middle; text-align: right; width: 20%; border: none;">
                                    ${delayHtml}
                                </td>
                            </tr>
                        </table>
                    `;
                }).join('');
            };

            trainTransferHtml = `
                <div style="margin-top: 5px; padding-top: 4px;">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #232323; text-align: center;">JR手稲駅 時刻表</div>
                    
                    <div style="display: flex; border: 1px solid #ddd; margin-bottom: 10px; border-radius: 4px; overflow: hidden;">
                        <div id="jr-tab-sapporo" onclick="switchJrDirection('sapporo')" style="flex: 1; text-align: center; padding: 8px; cursor: pointer; font-size: 13px; background: #232323; color: #fff; font-weight: bold;">札幌方面</div>
                        <div id="jr-tab-otaru" onclick="switchJrDirection('otaru')" style="flex: 1; text-align: center; padding: 8px; cursor: pointer; font-size: 13px; background: #fafafa; color: #888; border-left: 1px solid #ddd;">小樽方面</div>
                    </div>

                    <div id="jr-content-sapporo" style="display: block; background: #fcfcfc; border: 1px solid #ccc; padding: 3px; border-radius: 4px;">
                        ${generateTrainHtml(sapporoTrains, "本日の運行終了")}
                    </div>

                    <div id="jr-content-otaru" style="display: none; background: #fcfcfc; border: 1px solid #ccc; padding: 3px; border-radius: 4px;">
                        ${generateTrainHtml(otaruTrains, "本日の運行終了")}
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

// ★ 元時刻のダイヤ情報に、現時刻の遅延（L列）を【A列の列車番号】をキーにしてマージする関数
function parseTeineAndLiveData(motoJson, genJson) {
    if (!motoJson || !motoJson.table || !motoJson.table.rows) return [];
    
    // 1. まずは「手稲駅_現時刻」シートから【列車番号：遅延分】の辞書を作成
    const delayMap = {};
    if (genJson && genJson.table && genJson.table.rows) {
        genJson.table.rows.forEach(row => {
            
            // 💡 A列 (インデックス0): 列車番号をキーにする！
            const trainNumberCol = row.c[0];
            let trainNumberKey = "";
            if (trainNumberCol && trainNumberCol.v !== null) {
                trainNumberKey = String(trainNumberCol.v).trim();
            }

            // L列 (インデックス11): 遅延分を安全に抽出
            let delay = 0;
            if (row.c[11] && row.c[11].v !== null) {
                const v = row.c[11].v;
                if (typeof v === 'number') {
                    delay = Math.round(v);
                } else {
                    const parsed = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
                    if (!isNaN(parsed)) delay = parsed;
                }
            }

            // 列車番号が存在すれば辞書に登録（例： "135M": 3 ）
            if (trainNumberKey) {
                delayMap[trainNumberKey] = delay;
            }
        });
    }

    // 2. 「手稲駅_元時刻」シートをベースに遅延マップを結合
    const motoRows = motoJson.table.rows;
    let parsed = [];
    
    motoRows.forEach(row => {
        const getVal = (col) => (col && col.v !== null) ? col.v : '';
        
        // 💡 元時刻シートのA列 (インデックス0): 列車番号を取得
        const trainNumberCol = row.c[0];
        let trainNumber = "";
        if (trainNumberCol && trainNumberCol.v !== null) {
            trainNumber = String(trainNumberCol.v).trim();
        }

        // B列: 時刻
        const timeCol = row.c[1];
        let timeStr = "";
        if (timeCol) {
            if (timeCol.f) timeStr = timeCol.f.trim(); 
            else if (Array.isArray(timeCol.v)) timeStr = `${timeCol.v[0]}:${String(timeCol.v[1]).padStart(2, '0')}`; 
            else timeStr = String(timeCol.v).trim();
        }
        
        const route = String(getVal(row.c[5])).trim();   // 列F: 種別
        const dest = String(getVal(row.c[6])).trim();    // 列G: 行先
        const directionStr = String(getVal(row.c[9]));   // 列J: 方面

        let h = null, m = null;
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            h = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
        }

        if (h !== null && !isNaN(h) && m !== null && !isNaN(m) && route && dest) {
            const isOtaruDirection = directionStr.includes("小樽");

            // 💡 列車番号をキーにして遅延データを引き出す（シンプルで最強！）
            const delay = trainNumber ? (delayMap[trainNumber] || 0) : 0;

            parsed.push({ 
                h, 
                m, 
                route, 
                dest, 
                isOtaruDirection,
                delay
            });
        }
    });
    
    parsed.sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));
    return parsed;
}

// ★ JR乗換モーダル内の方面切り替えロジック
function switchJrDirection(direction) {
    const tabSapporo = document.getElementById('jr-tab-sapporo');
    const tabOtaru = document.getElementById('jr-tab-otaru');
    const contentSapporo = document.getElementById('jr-content-sapporo');
    const contentOtaru = document.getElementById('jr-content-otaru');

    if (!tabSapporo || !tabOtaru || !contentSapporo || !contentOtaru) return;

    if (direction === 'sapporo') {
        tabSapporo.style.background = '#232323';
        tabSapporo.style.color = '#fff';
        tabSapporo.style.fontWeight = 'bold';
        contentSapporo.style.display = 'block';

        tabOtaru.style.background = '#fafafa';
        tabOtaru.style.color = '#888';
        tabOtaru.style.fontWeight = 'normal';
        contentOtaru.style.display = 'none';
    } else {
        tabOtaru.style.background = '#232323';
        tabOtaru.style.color = '#fff';
        tabOtaru.style.fontWeight = 'bold';
        contentOtaru.style.display = 'block';

        tabSapporo.style.background = '#fafafa';
        tabSapporo.style.color = '#888';
        tabSapporo.style.fontWeight = 'normal';
        contentSapporo.style.display = 'none';
    }
}