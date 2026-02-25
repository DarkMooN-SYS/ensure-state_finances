// ─── FiveM NUI Integration ──────────────────────────────────────────────────

const menu = document.getElementById('finances-menu');

// In FiveM, the menu is hidden until openMenu is triggered.
// For browser testing, comment out the line below.
menu.style.display = 'none';

// Collect all current slider & checkbox values as a key/value object.
// Keys are derived from the nearest h3 text (snake_cased).
function collectFinanceData() {
    const data = {};

    // Range sliders — value is 0-100 (percentage setting sent to server).
    document.querySelectorAll('input[type="range"]').forEach(input => {
        const card = input.closest('.card');
        if (!card || !card.dataset.key) return;
        // Slider is 0-10000; divide by 100 to send 0-100 back to server.
        data[card.dataset.key] = Math.round(parseInt(input.value, 10) / 100);
    });

    // Checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const card = cb.closest('.card');
        if (!card || !card.dataset.key) return;
        data[card.dataset.key] = cb.checked;
    });

    return data;
}

// Populate sliders & checkboxes from data sent by the client.
function populateFinanceData(data) {
    if (!data) return;

    document.querySelectorAll('input[type="range"]').forEach(input => {
        const card = input.closest('.card');
        if (!card || !card.dataset.key) return;
        const key = card.dataset.key;
        if (data[key] !== undefined) {
            // data[key] is 0-100 from server; scale to 0-10000 for the slider
            const sliderVal = data[key] * 100;
            input.value = sliderVal;
            const fill = input.previousElementSibling && input.previousElementSibling.children[0];
            if (fill) fill.style.width = data[key] + '%';
        }
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const card = cb.closest('.card');
        if (!card || !card.dataset.key) return;
        const key = card.dataset.key;
        if (data[key] !== undefined) cb.checked = data[key];
    });
}

// Update the stats labels sent from the client (revenue/cost/net).
function updateStats(stats) {
    if (!stats) return;
    if (stats.revenue !== undefined) document.getElementById('stat-revenue').textContent = stats.revenue;
    if (stats.costs   !== undefined) document.getElementById('stat-costs').textContent   = stats.costs;
    if (stats.net     !== undefined) {
        const netEl = document.getElementById('stat-net');
        netEl.textContent = stats.net;
        // Turn red if negative (starts with '-')
        const isNeg = String(stats.net).startsWith('-');
        netEl.className = isNeg
            ? 'stat-card__value stat-card__value--red'
            : 'stat-card__value stat-card__value--green';
    }
}

// Calculate footer stats from the per-card prevStats values.
// Revenue = cards with .card-stat-value--rev / --green / --teal / --blue / --yellow
// Costs   = cards with .card-stat-value--cost
function calculateStatsFromPrevStats(prevStats) {
    if (!prevStats) return;
    let revenue = 0, costs = 0;
    document.querySelectorAll('.card').forEach(card => {
        const key = card.dataset.key;
        if (!key || prevStats[key] === undefined) return;
        const val = Number(prevStats[key]);
        const valueEl = card.querySelector('.card-stat-value');
        if (!valueEl) return;
        if (valueEl.classList.contains('card-stat-value--cost')) {
            costs += val;
        } else {
            revenue += val;
        }
    });
    const net = revenue - costs;
    updateStats({
        revenue: '$' + revenue.toLocaleString(),
        costs:   '$' + costs.toLocaleString(),
        net:     (net < 0 ? '-$' : '$') + Math.abs(net).toLocaleString(),
    });
}

// Populate per-card stat values (Prev. 7-Day Rev./Cost) from backend data.
// Keys are derived the same way as collectFinanceData (snake_cased h3 text).
function populatePrevStats(prevStats) {
    if (!prevStats) return;
    // prevStats values are dollar amounts shown as the Prev. 7-Day Rev./Cost label.
    // Only update the display text — slider position comes from populateFinanceData.
    document.querySelectorAll('.card').forEach(card => {
        const key = card.dataset.key;
        if (!key || prevStats[key] === undefined) return;
        const dollarVal = Number(prevStats[key]);
        const valueEl   = card.querySelector('.card-stat-value');
        if (valueEl) valueEl.textContent = '$' + dollarVal.toLocaleString();
    });
}

// Send a NUI callback to the FiveM client resource.
// In browser (non-FiveM) mode, skips the fetch and runs the callback directly.
function nuiCallback(name, data, cb) {
    if (typeof GetParentResourceName === 'undefined') {
        // Browser testing mode — simulate instant success
        if (cb) cb('ok');
        return;
    }
    fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data)
    }).then(resp => resp.json()).then(cb || (() => {})).catch(() => {});
}

// Show the menu.
function showMenu(data) {
    populateFinanceData(data && data.finances);
    if (data && data.prevStats) {
        populatePrevStats(data.prevStats);
        calculateStatsFromPrevStats(data.prevStats);
    }
    // If server sends pre-computed stats, use those (overrides calculated values).
    if (data && data.stats) updateStats(data.stats);
    menu.style.display = '';
}

// Hide the menu.
function hideMenu() {
    menu.style.display = 'none';
}

// ─── NUI Message Listener ────────────────────────────────────────────────────
window.addEventListener('message', function(event) {
    const msg = event.data;
    switch (msg.type) {
        case 'openMenu':
            showMenu(msg);
            break;
        case 'closeMenu':
            hideMenu();
            break;
        case 'updateStats':
            updateStats(msg.stats);
            break;
        case 'updatePrevStats':
            if (msg.prevStats) {
                populatePrevStats(msg.prevStats);
                calculateStatsFromPrevStats(msg.prevStats);
            }
            if (msg.stats) updateStats(msg.stats);
            break;
    }
});

// ─── Button Handlers ─────────────────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', function() {
    const finances = collectFinanceData();
    nuiCallback('saveFinances', { finances }, function() {
        hideMenu();
    });
});

document.getElementById('close-btn').addEventListener('click', function() {
    nuiCallback('closeMenu', {}, function() {
        hideMenu();
    });
});

// ESC key closes the menu.
// E key opens the menu (browser testing only).
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        nuiCallback('closeMenu', {}, function() {
            hideMenu();
        });
    }
    if (e.key === 'e' || e.key === 'E') {
        showMenu(null);
    }
});

// ─── Calendar & UI Logic ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

    // ── Slider init ──────────────────────────────────────────────────────────
    document.querySelectorAll('input[type="range"]').forEach(input => {
        input.setAttribute('max',  '10000');
        input.setAttribute('step', '1');
        input.removeAttribute('oninput');
        input.value = 0;
        const fill = input.previousElementSibling && input.previousElementSibling.children[0];
        if (fill) fill.style.width = '0%';
        const card = input.closest('.card');
        if (card) {
            const valueEl = card.querySelector('.card-stat-value');
            if (valueEl) valueEl.textContent = '$0';
        }
        input.addEventListener('input', function() {
            const fill = this.previousElementSibling && this.previousElementSibling.children[0];
            if (fill) fill.style.width = (parseInt(this.value, 10) / 100) + '%';
            const card = this.closest('.card');
            if (!card) return;
            const valueEl = card.querySelector('.card-stat-value');
            if (valueEl) valueEl.textContent = '$' + parseInt(this.value, 10).toLocaleString();
        });
    });

    // ── Calendar state ───────────────────────────────────────────────────────
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                          'Jul','Aug','Sep','Oct','Nov','Dec'];

    let calYear, calMonth;
    let activeRange   = 7;      // Last 7 Days by default
    let customMode    = false;
    let customStart   = null;
    let customEnd     = null;

    const calendarBtn   = document.getElementById('calendar-btn');
    const calendarModal = document.getElementById('calendar-modal');
    const calMonthLabel = document.getElementById('cal-month-label');
    const calDaysGrid   = document.getElementById('cal-days-grid');
    const calRangeLabel = document.getElementById('cal-range-label-text');
    const statsTitle    = document.getElementById('stats-range-title');
    const rangeButtons  = document.querySelectorAll('.cal-filters .cal-filter-btn');

    // ── Close calendar ───────────────────────────────────────────────────────
    function closeCalendar() {
        calendarModal.classList.add('hidden');
        calendarBtn.classList.remove('active');
    }

    // ── Update header label + stats title ────────────────────────────────────
    function setRangeLabel(text) {
        if (calRangeLabel) calRangeLabel.textContent = text;
        if (statsTitle)    statsTitle.textContent    = 'Approximate State Account Statistics for the ' + text + ':';
    }

    // ── Request stats from backend ───────────────────────────────────────────
    // Result arrives via window.addEventListener 'updatePrevStats' NUI message.
    function requestStatsForRange(days) {
        nuiCallback('requestStats', { range: days });
    }

    // ── Render calendar ──────────────────────────────────────────────────────
    function renderCalendar(year, month) {
        calYear  = year;
        calMonth = month;
        calMonthLabel.textContent = MONTHS[month] + ' ' + year;
        calDaysGrid.innerHTML = '';

        const today       = new Date();
        const firstDay    = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Compute highlighted range
        let rangeStart = null, rangeEnd = null;
        if (!customMode) {
            rangeEnd   = new Date(today); rangeEnd.setHours(23, 59, 59, 999);
            rangeStart = new Date(today); rangeStart.setDate(today.getDate() - activeRange + 1);
            rangeStart.setHours(0, 0, 0, 0);
        } else if (customStart && customEnd) {
            rangeStart = customStart < customEnd ? customStart : customEnd;
            rangeEnd   = customStart < customEnd ? customEnd   : customStart;
        }

        for (let i = 0; i < firstDay; i++) {
            const sp = document.createElement('span');
            sp.className = 'cal-spacer';
            calDaysGrid.appendChild(sp);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const btn     = document.createElement('button');
            const thisDay = new Date(year, month, d);
            btn.className   = 'calendar-day';
            btn.textContent = d;

            if (thisDay > today) {
                btn.disabled = true;
            } else if (rangeStart && rangeEnd) {
                if (thisDay >= rangeStart && thisDay <= rangeEnd) {
                    const isEndpoint = thisDay.toDateString() === rangeStart.toDateString() ||
                                       thisDay.toDateString() === rangeEnd.toDateString();
                    btn.classList.add(isEndpoint ? 'selected' : 'in-range');
                }
            } else if (customMode && customStart && !customEnd) {
                if (thisDay.toDateString() === customStart.toDateString()) btn.classList.add('selected');
            }

            btn.addEventListener('click', (function(day, date) {
                return function() {
                    if (!customMode) return;
                    if (!customStart || (customStart && customEnd)) {
                        customStart = new Date(date);
                        customEnd   = null;
                    } else {
                        customEnd = new Date(date);
                        const s    = customStart < customEnd ? customStart : customEnd;
                        const e    = customStart < customEnd ? customEnd   : customStart;
                        const days = Math.round((e - s) / (86400000)) + 1;
                        const lbl  = SHORT_MONTHS[s.getMonth()] + ' ' + s.getDate() +
                                     ' – ' + SHORT_MONTHS[e.getMonth()] + ' ' + e.getDate();
                        setRangeLabel(lbl);
                        requestStatsForRange(days);
                        closeCalendar();
                    }
                    renderCalendar(calYear, calMonth);
                };
            })(d, new Date(year, month, d)));

            calDaysGrid.appendChild(btn);
        }
    }

    // ── Range filter buttons ─────────────────────────────────────────────────
    rangeButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            rangeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const range = this.dataset.range;
            if (range === 'custom') {
                customMode  = true;
                customStart = null;
                customEnd   = null;
                renderCalendar(calYear, calMonth);
            } else {
                customMode  = false;
                customStart = null;
                customEnd   = null;
                activeRange = parseInt(range, 10);
                const lbl   = 'Last ' + range + ' Days';
                setRangeLabel(lbl);
                requestStatsForRange(activeRange);
                renderCalendar(calYear, calMonth);
                closeCalendar();
            }
        });
    });

    // ── Calendar open/close ──────────────────────────────────────────────────
    calendarBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (calendarModal.classList.contains('hidden')) {
            calendarModal.classList.remove('hidden');
            calendarBtn.classList.add('active');
        } else {
            closeCalendar();
        }
    });

    document.addEventListener('click', function(e) {
        if (!calendarModal.contains(e.target) && !calendarBtn.contains(e.target)) {
            closeCalendar();
        }
    });

    calendarModal.addEventListener('click', function(e) { e.stopPropagation(); });

    // ── Month navigation ─────────────────────────────────────────────────────
    document.getElementById('cal-prev-month').addEventListener('click', function(e) {
        e.stopPropagation();
        if (calMonth === 0) { calYear--; calMonth = 11; } else { calMonth--; }
        renderCalendar(calYear, calMonth);
    });

    document.getElementById('cal-next-month').addEventListener('click', function(e) {
        e.stopPropagation();
        const now = new Date();
        if (calYear < now.getFullYear() || (calYear === now.getFullYear() && calMonth < now.getMonth())) {
            if (calMonth === 11) { calYear++; calMonth = 0; } else { calMonth++; }
            renderCalendar(calYear, calMonth);
        }
    });

    // ── Initial render ───────────────────────────────────────────────────────
    const now = new Date();
    renderCalendar(now.getFullYear(), now.getMonth());
    setRangeLabel('Last 7 Days');

    // ── Accordion ────────────────────────────────────────────────────────────
    const sections = document.querySelectorAll('details.section');
    sections.forEach(detail => {
        detail.addEventListener('toggle', function() {
            if (this.open) {
                sections.forEach(other => {
                    if (other !== this && other.open) other.open = false;
                });
            }
        });
    });
    if (sections.length > 0) sections[0].open = true;
});
