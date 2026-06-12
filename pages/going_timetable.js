// URLのパラメータ「?id=X」を解析する
const urlParams = new URLSearchParams(window.location.search);
const busStopId = urlParams.get('id') || '0'; // 指定がなければデフォルトで '0'

// 【行き用 マスター規定】
const BUS_STOP_MASTERS = {
    '0': {
        title: "バス発車標 - 手稲駅北口",
        sheet1: "手稲駅北口",
        sheet2: "school_teine",
        mapUrl: "https://maps.app.goo.gl/FTQBXNLsAMokk44q6", 
        config: [
            { name: "循環手48" },
            { name: "手85" },
            { name: "スクール" }
        ]
    },
    '1': {
        title: "バス発車標 - 宮の沢駅",
        sheet1: "宮の沢駅",
        sheet2: "school_miyanosawa",
        mapUrl: "https://maps.app.goo.gl/V9HvydjDLnNHxmYi8",
        config: [
            { name: "宮79" },
            { name: "スクール" }
        ]
    },
    '2': {
        title: "バス発車標 - 星置駅",
        sheet1: "星置駅",
        mapUrl: "https://maps.app.goo.gl/CU33Sm4fjnfRKVTi6",
        config: [
            { name: "手85" }
        ]
    }
};

// ★ 大学までの到着予想を計算するための所要時間（分）定数
const TRAVEL_TIMES = {
    '0': { '循環手48': 10, '手85': 10, 'スクール': 9 },
    '1': { '宮79': 25, 'スクール': 20 },
    '2': { '手85': 13 }
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
    "スクール": { bg: "#ffff33", text: "#232323" }
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
    if (routeNumber === "循環手48" || routeNumber === "スクール") {
        return `background-color: ${color.bg}; color: ${color.text}; font-size: 13px; padding: 2px 4px;`;
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

const DIRECTION_CONFIG = currentStop.config;

// 💡 【バグ修正】画面幅（PC⇔スマホ）の切り替えを監視するイベントを追加
let lastIsMobile = window.innerWidth <= 600;
window.addEventListener('resize', () => {
    const currentIsMobile = window.innerWidth <= 600;
    // 600pxの境界線を跨いだ時だけ表示を即座に作り直す（リサイズバグの解消）
    if (lastIsMobile !== currentIsMobile) {
        lastIsMobile = currentIsMobile;
        renderNextBuses();
    }
});

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

    const filterLabel = document.querySelector('label[for="dest-select"]');
    if (filterLabel) {
        filterLabel.innerText = "系統:";
    }

    try {
        const baseUrl = "https://docs.google.com/spreadsheets/d/1FjixtV7RSD3oJ_KskkLw-Pme-5t85rfGqofP2gIRAjg/gviz/tq?tqx=out:json";
        
        let fetchPromises = [fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet1)}`)];
        if (currentStop.sheet2) {
            fetchPromises.push(fetch(`${baseUrl}&sheet=${encodeURIComponent(currentStop.sheet2)}`));
        }

        const responses = await Promise.all(fetchPromises);
        const texts = await Promise.all(responses.map(res => res.text()));

        const json1 = responseToJson(texts[0]);
        allData = parseSheetData(json1);

        if (currentStop.sheet2) {
            const json2 = responseToJson(texts[1]);
            const data2 = parseSheetData(json2);
            allData = [...allData, ...data2];
        }

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
            number: String(getVal(row.c[4])).trim(),
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
    
    const allowedRoutes = DIRECTION_CONFIG.map(dir => dir.name);
    const currentData = allData.filter(d => d.date === currentDate && allowedRoutes.includes(d.number));
    const uniqueRoutes = [...new Set(currentData.map(d => d.number))].filter(d => d !== '');
    
    select.innerHTML = '<option value="all">すべて</option>';
    uniqueRoutes.forEach(route => {
        const option = document.createElement('option');
        option.value = route;
        option.innerText = route;
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

    // HTML側の不要なタブ領域（lcd-header）を強制的に抹殺
    const lcdHeader = document.querySelector('.lcd-header');
    if (lcdHeader) lcdHeader.style.display = 'none';

    let targetData = allData.filter(d => d.date === currentDate);
    const currentTotalMin = simHour * 60 + simMin;

    const upcoming = targetData.filter(bus => {
        const busTotalMin = bus.h * 60 + bus.m;
        return busTotalMin >= currentTotalMin;
    });

    const isMobile = window.innerWidth <= 600;
    const allowedRoutes = DIRECTION_CONFIG.map(dir => dir.name);
    const allowedUpcoming = upcoming.filter(bus => allowedRoutes.includes(bus.number));
    
    // 全体で一番早いバス（絶対最速便）を取得
    const absoluteNextBus = allowedUpcoming.length > 0 ? allowedUpcoming[0] : null;

    if (isMobile) {
        // ==========================================
        // ▼ スマホ版：全系統混合で直近3件を1列に表示
        // ==========================================
        const matchBuses = allowedUpcoming.slice(0, 3); 

        let columnHtml = `<div class="bus-column" style="display: block; width: 100%;">`;

        if (matchBuses.length === 0) {
            columnHtml += `
                <div class="bus-card" style="display: flex; justify-content: center; align-items: center; text-align: center;">
                    <span style="font-size: 14px; color: #aaa; font-weight: bold;">直近のバスはありません</span>
                </div>
            `;
        } else {
            matchBuses.forEach((bus, index) => {
                const busJson = encodeURIComponent(JSON.stringify(bus)).replace(/'/g, "%27");
                const diffMin = (bus.h * 60 + bus.m) - currentTotalMin;
                const minStr = String(bus.m).padStart(2, '0');
                
                const firstBadge = (bus.isFirst == 1) ? '<span class="c-first">始発</span>' : '';
                const infoIconHtml = bus.bikou ? `<span class="c-info-btn" style="display:inline-flex; align-items:center; justify-content:center; margin-left:4px; vertical-align:middle;">！</span>` : '';
                const routeStyle = getRouteStyle(bus.number);
                const depTimeColor = getDepartureTimeColor(diffMin);

                let rowClass = index === 0 ? 'primary' : 'sub-row';

                // 💡 【スマホ版】完全一致ではなく「含まれるか (includes)」で判定し、確実にスタイルを適用
                const destStyle = bus.dest.includes("北海道科学大学") ? "font-size: 13px;" : "";

                columnHtml += `
                    <div class="bus-card ${rowClass}" onclick="openBusModal('${busJson}')" style="cursor: pointer; margin-bottom: 8px;">
                        <div class="card-row-1">
                            <span class="c-route" style="${routeStyle}">${bus.number}</span>
                            ${firstBadge}
                            <span class="c-time">${bus.h}:${minStr}</span>
                        </div>
                        <div class="card-row-2">
                            <span class="c-dest" style="${destStyle}">${bus.dest}${infoIconHtml}</span>
                            <span class="c-countdown">あと<span style="font-size:18px; ${depTimeColor}">${diffMin}分</span></span>
                        </div>
                    </div>
                `;
            });
        }
        columnHtml += `</div>`;
        container.innerHTML = columnHtml;

    } else {
        // ==========================================
        // ▼ PC版：系統ごとに列を分割
        // ==========================================
        DIRECTION_CONFIG.forEach((dir, index) => {
            const matchBuses = allowedUpcoming.filter(bus => {
                const busTotalMin = bus.h * 60 + bus.m;
                const isWithin450Min = (busTotalMin - currentTotalMin) <= 450;
                return bus.number === dir.name && isWithin450Min;
            }).slice(0, 3);

            let columnHtml = `
                <div id="dir-col-${index}" class="bus-column">
                    <div style="text-align:center;">
                        <span class="c-dir-name" style="font-size: 20px;">${dir.name}</span>
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
                    
                    let rowClass = 'sub-row';
                    const firstBadge = (bus.isFirst == 1) ? '<span class="c-first">始発</span>' : '';
                    const infoIconHtml = bus.bikou ? `<span class="c-info-btn" style="display:inline-flex; align-items:center; justify-content:center; margin-left:4px; vertical-align:middle;">！</span>` : '';
                    const routeStyle = getRouteStyle(bus.number);
                    const depTimeColor = getDepartureTimeColor(diffMin);

                    let customCardStyle = "cursor: pointer;";
                    
                    if (absoluteNextBus && bus === absoluteNextBus) {
                        rowClass = 'primary'; 
                        customCardStyle += " background: linear-gradient(145deg, #fffde6, #fff9b3); border: 2px solid #ffcc00; box-shadow: 0 4px 8px rgba(255,204,0,0.2);";
                    }

                    // 💡 【PC版】ここにも同じ文字サイズ変更処理を追加！
                    const destStyle = bus.dest.includes("北海道科学大学") ? "font-size: 15px;" : "";

                    columnHtml += `
                        <div class="bus-card ${rowClass}" onclick="openBusModal('${busJson}')" style="${customCardStyle}">
                            <div class="card-row-1">
                                <span class="c-route" style="${routeStyle}">${bus.number}</span>
                                ${firstBadge}
                                <span class="c-time">${bus.h}:${minStr}</span>
                            </div>
                            <div class="card-row-2">
                                <span class="c-dest" style="${destStyle}">${bus.dest}${infoIconHtml}</span>
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
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    const selectEl = document.getElementById('dest-select');
    const selectedRoute = selectEl ? selectEl.value : 'all';
    
    tbody.innerHTML = '';

    let displayData = allData.filter(d => d.date === currentDate);
    const allowedRoutes = DIRECTION_CONFIG.map(dir => dir.name);
    displayData = displayData.filter(d => allowedRoutes.includes(d.number));
    
    if (selectedRoute !== 'all') {
        displayData = displayData.filter(d => d.number === selectedRoute);
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

        // 💡 【表（テーブル）版】ここにも文字サイズ変更を追加！表は通常時16pxなので、13pxくらいが丁度いいです。
        const destStyle = bus.dest.includes("北海道科学大学") ? "" : "";

        tr.style.cursor = 'pointer';
        tr.onclick = () => openBusModal(busJson);

        tr.innerHTML = `
            <td><span class="c-route" style="${routeStyle}">${bus.number}</span></td>
            <td style="text-align: center; vertical-align: middle;">
                <span style="display: inline-flex; align-items: center; justify-content: center; gap: 2px; ${destStyle}">
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
            const container = document.getElementById('timetable-wrap');
            if (container && closestRowEl) {
                const headerHeight = container.querySelector('thead')?.offsetHeight || 0;
                const targetTop = closestRowEl.offsetTop - headerHeight;
                container.scrollTo({
                    top: targetTop,
                    behavior: 'smooth'
                });
            }
        }, 100);
    }
}
function openBusModal(encodedBus) {
    const bus = JSON.parse(decodeURIComponent(encodedBus));
    const minStr = String(bus.m).padStart(2, '0');
    const routeStyle = getRouteStyle(bus.number);
    
    let etaHtml = '';

    const baseTravelTime = (TRAVEL_TIMES[busStopId] && TRAVEL_TIMES[busStopId][bus.number]) ? TRAVEL_TIMES[busStopId][bus.number] : null;
    
    if (baseTravelTime) {
        const estTotalMin = bus.h * 60 + bus.m + baseTravelTime;
        const arrTime = `${Math.floor(estTotalMin / 60) % 24}:${String(estTotalMin % 60).padStart(2, '0')}`;
        
        etaHtml = `
            <div style="text-align: left; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
                <span style="color: #666;">到着予想 <span style="font-size:12px;">(科学大学)</span></span>
                <span style="float: right; font-weight: bold; font-size: 20px; color: #d9333f;">${arrTime}</span>
            </div>
        `;
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