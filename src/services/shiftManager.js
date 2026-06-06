import { getActiveShift, saveActiveShift, addShift, getSettings, getGeofenceState, saveGeofenceState } from './storage';

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '0h 0m';
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hours}h ${mins}m`;
}

export function calcWage(ms, hourlyRate) {
  const hours = ms / 3600000;
  return (hours * hourlyRate).toFixed(2);
}

// Returns true if the timestamp falls on Shabbat (Fri 18:00+ or all Saturday)
export function isShabbat(timestamp) {
  const d = new Date(timestamp);
  const day = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
  if (day === 6) return true;
  if (day === 5 && d.getHours() >= 18) return true;
  return false;
}

// Israeli law wage breakdown
// On Shabbat/holiday the base rate is 150%, overtime multipliers still apply on top:
//   regular hours: 150%  |  OT1 (h9-10): 150%×1.25=187.5%  |  OT2 (h11+): 150%×1.5=225%
export function calcWageIsraeli(ms, hourlyRate, shabbatOrHoliday, standardHours = 8) {
  const hours = ms / 3600000;
  const baseMultiplier = shabbatOrHoliday ? 1.5 : 1.0;

  const regularHours = Math.min(hours, standardHours);
  const overtime = Math.max(0, hours - standardHours);
  const ot1Hours = Math.min(overtime, 2);
  const ot2Hours = Math.max(0, overtime - 2);

  const total = regularHours * hourlyRate * baseMultiplier
    + ot1Hours * hourlyRate * baseMultiplier * 1.25
    + ot2Hours * hourlyRate * baseMultiplier * 1.5;

  return {
    total: total.toFixed(2),
    regularHours: parseFloat(regularHours.toFixed(2)),
    ot1Hours: parseFloat(ot1Hours.toFixed(2)),
    ot2Hours: parseFloat(ot2Hours.toFixed(2)),
    shabbat: shabbatOrHoliday,
    baseMultiplier,
  };
}

export function calcWageForShift(shift, settings) {
  const ms = shift.endTime - shift.startTime;

  // Per-shift override: null = follow global setting, true/false = force on/off
  const useIsraeli = shift.israeliOverride !== undefined && shift.israeliOverride !== null
    ? shift.israeliOverride
    : settings.israeliLaw;

  if (!useIsraeli) {
    return { total: calcWage(ms, settings.hourlyRate), breakdown: null };
  }

  // Shabbat replaces tiered overtime — never both at once
  const shabbat = shift.shabbat ?? isShabbat(shift.startTime);
  const breakdown = calcWageIsraeli(ms, settings.hourlyRate, shabbat, settings.israeliStandardHours);
  return { total: breakdown.total, breakdown };
}

// Start a shift manually or from auto-trigger
export async function startShift(startTime = Date.now()) {
  const existing = await getActiveShift();
  if (existing) return existing;
  const shift = {
    id: generateId(),
    startTime,
    endTime: null,
    autoStarted: startTime < Date.now() - 5000, // backdated if >5s ago
    breaks: [],
  };
  await saveActiveShift(shift);
  return shift;
}

// End the active shift — if manual=true, sets a flag to suppress auto-restart while still inside
export async function endShift(endTime = Date.now(), manual = false) {
  const shift = await getActiveShift();
  if (!shift) return null;
  const completed = { ...shift, endTime };
  await addShift(completed);
  await saveActiveShift(null);
  if (manual) {
    // Clear arrivedAt so auto-start can't backdate to old arrival + block until user leaves and returns
    const state = await getGeofenceState();
    await saveGeofenceState({ ...state, manuallyEnded: true, arrivedAt: null });
  }
  return completed;
}

// Called when device exits the geofence
export async function handleGeofenceExit() {
  const state = await getGeofenceState();
  // Leaving clears the manually-ended flag — next return is a fresh arrival
  await saveGeofenceState({ ...state, leftAt: Date.now(), insideGeofence: false, manuallyEnded: false });
}

// Called when device enters the geofence
export async function handleGeofenceEnter() {
  const state = await getGeofenceState();
  const settings = await getSettings();
  const now = Date.now();

  // Already inside — ignore spurious re-entry, preserve manuallyEnded flag
  if (state.insideGeofence) return;

  if (state.leftAt) {
    const awayMins = (now - state.leftAt) / 60000;
    if (awayMins >= settings.breakThresholdMinutes) {
      // Long absence — fresh arrival, reset everything
      await saveGeofenceState({ insideGeofence: true, arrivedAt: now, leftAt: null, manuallyEnded: false });
    } else {
      // Short break — keep arrivedAt, clear leftAt, preserve manuallyEnded
      await saveGeofenceState({ insideGeofence: true, arrivedAt: state.arrivedAt, leftAt: null, manuallyEnded: state.manuallyEnded });
    }
  } else {
    await saveGeofenceState({ insideGeofence: true, arrivedAt: now, leftAt: null, manuallyEnded: false });
  }
}

// Checks if auto-shift-end should fire
export async function checkAutoEnd() {
  const state = await getGeofenceState();
  const settings = await getSettings();
  if (!state.insideGeofence && state.leftAt) {
    const awayMins = (Date.now() - state.leftAt) / 60000;
    if (awayMins >= settings.breakThresholdMinutes) {
      const active = await getActiveShift();
      if (active) {
        await endShift(state.leftAt); // auto-end, not manual
        return { ended: true, endTime: state.leftAt };
      }
    }
  }
  return { ended: false };
}

// Checks if auto-shift-start should fire
export async function checkAutoStart() {
  const state = await getGeofenceState();
  const settings = await getSettings();
  // Don't auto-start if user manually ended while still inside
  if (state.manuallyEnded) return null;
  if (state.insideGeofence && state.arrivedAt) {
    const active = await getActiveShift();
    if (!active) {
      const waitedMins = (Date.now() - state.arrivedAt) / 60000;
      if (waitedMins >= settings.autoStartDelayMinutes) {
        return await startShift(state.arrivedAt);
      }
    }
  }
  return null;
}
