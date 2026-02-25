-- ─── State Finances — Client ────────────────────────────────────────────────

local menuOpen = false

-- ─── Helpers ────────────────────────────────────────────────────────────────

local function openMenu(finances, stats, prevStats)
    menuOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        type      = 'openMenu',
        finances  = finances  or {},
        stats     = stats     or {},
        prevStats = prevStats or {}
    })
end

local function closeMenu()
    menuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'closeMenu' })
end

-- ─── NUI Callbacks ──────────────────────────────────────────────────────────

-- Called when the player clicks "Save Changes"
RegisterNUICallback('saveFinances', function(data, cb)
    TriggerServerEvent('stateFinances:saveFinances', data.finances)
    closeMenu()
    cb('ok')
end)

-- Called when the player clicks "Close" or presses ESC
RegisterNUICallback('closeMenu', function(data, cb)
    closeMenu()
    cb('ok')
end)

-- Called when the calendar range changes
RegisterNUICallback('requestStats', function(data, cb)
    TriggerServerEvent('stateFinances:requestStats', tonumber(data.range) or 7)
    cb('ok')
end)

-- ─── Server → Client Events ──────────────────────────────────────────────────

-- Server tells this client to open the menu and provides current data
RegisterNetEvent('stateFinances:openMenu', function(finances, stats, prevStats)
    openMenu(finances, stats, prevStats)
end)

-- Server broadcasts updated stats to all clients (live update)
RegisterNetEvent('stateFinances:updateStats', function(stats)
    SendNUIMessage({
        type  = 'updateStats',
        stats = stats
    })
end)

-- Server sends range-scaled prevStats back to this client (calendar range change)
RegisterNetEvent('stateFinances:updatePrevStats', function(newPrevStats, newStats)
    SendNUIMessage({
        type      = 'updatePrevStats',
        prevStats = newPrevStats,
        stats     = newStats,
    })
end)

-- ─── Dev / Admin Command ─────────────────────────────────────────────────────
-- Usage: /finances   (remove or gate behind a permission check in production)
RegisterCommand('finances', function()
    TriggerServerEvent('stateFinances:requestOpen')
end, false)
