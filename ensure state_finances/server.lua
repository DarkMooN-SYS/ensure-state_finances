-- ─── State Finances — Server ────────────────────────────────────────────────

-- ─── Default Finance Data ────────────────────────────────────────────────────
-- These are the default slider values (0-100).
-- Replace the hard-coded defaults with a database read (e.g. oxmysql) as needed.

local finances = {
    general_tax               = 45,
    fuel_tax                  = 25,
    vehicle_tax               = 60,
    income_tax                = 55,

    residential_property_tax  = 30,
    commercial_property_tax   = 40,
    industrial_property_tax   = 55,
    office_property_tax       = 45,
    utility_property_tax      = 25,
    vacant_property_tax       = 65,

    residential_power_subsidy = 15,
    commercial_power_subsidy  = 10,
    industrial_power_subsidy  = 10,
    office_power_subsidy      = 10,
    utility_power_subsidy     = 10,
    vacant_power_subsidy      = 10,

    police_employee_salary        = 65,
    police_equipment_sales_tax     = 45,

    public_defender_salary    = 45,
    judge_salary              = 55,
    county_clerk_salary       = 48,
    city_council_salary       = 35,
    doc_salary                = 40,
    fine_costs                = 60,
    sentence_lengths          = 75,

    -- EMS
    ems_employee_salary            = 45,
    doctor_salary                  = 60,
    therapist_salary               = 30,
    ems_equipment_sales_tax        = 25,

    -- Mechanic
    mechanic_equipment_sales_tax   = 55,

    -- Checkbox
    efficient_medical_supplies_investment = false,
}

-- ─── Stats Calculator ──────────────────────────────────────────────────────
-- Automatically sums prevStats into revenue / costs / net.

local revenueKeys = {
    'general_tax', 'fuel_tax', 'vehicle_tax', 'income_tax',
    'residential_property_tax', 'commercial_property_tax',
    'industrial_property_tax',  'office_property_tax',
    'utility_property_tax',     'vacant_property_tax',
    'police_equipment_sales_tax',
    'fine_costs',
    'ems_equipment_sales_tax',
    'mechanic_equipment_sales_tax',
}

local costKeys = {
    'residential_power_subsidy', 'commercial_power_subsidy',
    'industrial_power_subsidy',  'office_power_subsidy',
    'utility_power_subsidy',     'vacant_power_subsidy',
    'police_employee_salary',
    'public_defender_salary', 'judge_salary', 'county_clerk_salary',
    'city_council_salary',    'doc_salary',   'sentence_lengths',
    'ems_employee_salary', 'doctor_salary', 'therapist_salary',
}

local function formatMoney(amount)
    local s = tostring(math.floor(math.abs(amount)))
    local result = ''
    local len = #s
    for i = 1, len do
        if i > 1 and (len - i + 1) % 3 == 0 then
            result = result .. ','
        end
        result = result .. s:sub(i, i)
    end
    local prefix = amount < 0 and '-$' or '$'
    return prefix .. result
end

local function calculateStats(ps)
    local rev, cost = 0, 0
    for _, k in ipairs(revenueKeys) do rev  = rev  + (ps[k] or 0) end
    for _, k in ipairs(costKeys)    do cost = cost + (ps[k] or 0) end
    return {
        revenue = formatMoney(rev),
        costs   = formatMoney(cost),
        net     = formatMoney(rev - cost),
    }
end

-- ─── Previous 7-Day Per-Card Stats ──────────────────────────────────────────
-- Dollar amounts shown next to each slider (Prev. 7-Day Rev. / Cost).
-- Keys match the data-key attribute of each card in index.html.
-- stats is computed automatically from prevStats below.

local prevStats = {
    -- Global Taxes
    general_tax               = 127034,
    fuel_tax                  = 6653,
    vehicle_tax               = 51684,
    income_tax                = 74407,

    -- Property Taxes
    residential_property_tax  = 441,
    commercial_property_tax   = 1204,
    industrial_property_tax   = 892,
    office_property_tax       = 2105,
    utility_property_tax      = 340,
    vacant_property_tax       = 0,

    -- Property Subsidies (costs)
    residential_power_subsidy = 4847,
    commercial_power_subsidy  = 2301,
    industrial_power_subsidy  = 0,
    office_power_subsidy      = 10,
    utility_power_subsidy     = 0,
    vacant_power_subsidy      = 0,

    -- Police
    police_employee_salary         = 241755,
    police_equipment_sales_tax     = 1351,

    -- DOJ
    public_defender_salary    = 28524,
    judge_salary              = 30375,
    county_clerk_salary       = 29189,
    city_council_salary       = 5213,
    doc_salary                = 8609,
    fine_costs                = 292920,
    sentence_lengths          = 146250,

    -- EMS
    ems_employee_salary            = 63840,
    doctor_salary                  = 85843,
    therapist_salary               = 0,
    ems_equipment_sales_tax        = 3743,

    -- Mechanic
    mechanic_equipment_sales_tax   = 32327,
    -- Checkbox (no prevStat value needed)
}

-- Auto-calculate footer stats from prevStats.
local stats = calculateStats(prevStats)

-- ─── Permission Check ────────────────────────────────────────────────────────
-- Returns true if the player is allowed to open the menu.
-- Hook this up to your ACE permissions / job system as needed.

local function hasPermission(source)
    -- Example ACE check (uncomment to use):
    -- return IsPlayerAceAllowed(source, 'stateFinances.manage')
    return true  -- allow everyone for now (dev mode)
end

-- ─── Events ──────────────────────────────────────────────────────────────────

-- Client requests to open the menu
RegisterNetEvent('stateFinances:requestOpen', function()
    local src = source
    if not hasPermission(src) then return end
    TriggerClientEvent('stateFinances:openMenu', src, finances, stats, prevStats)
end)

-- Client requests stats for a given day range (calendar change)
RegisterNetEvent('stateFinances:requestStats', function(days)
    local src = source
    if not hasPermission(src) then return end
    days = math.max(1, math.min(tonumber(days) or 7, 365))

    -- Scale prevStats proportionally to the requested range
    local scaled = {}
    for k, v in pairs(prevStats) do
        if type(v) == 'number' then
            scaled[k] = math.floor(v * days / 7)
        end
    end
    local scaledStats = calculateStats(scaled)
    TriggerClientEvent('stateFinances:updatePrevStats', src, scaled, scaledStats)
end)

-- Client saves new finance values
RegisterNetEvent('stateFinances:saveFinances', function(newFinances)
    local src = source
    if not hasPermission(src) then return end

    -- Merge received values into the stored table
    for k, v in pairs(newFinances) do
        finances[k] = v
    end

    print('[StateFinances] Saved by player ' .. src)

    -- TODO: persist to database here, e.g.:
    -- MySQL.update('UPDATE state_finances SET value = ? WHERE `key` = ?', {v, k})

    -- Broadcast updated stats to all clients (recalculate if needed)
    -- stats = recalculateStats(finances)  -- plug in your own logic
    TriggerClientEvent('stateFinances:updateStats', -1, stats)
end)
