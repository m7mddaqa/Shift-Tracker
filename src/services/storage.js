import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SHIFTS: 'shifts',
  ACTIVE_SHIFT: 'active_shift',
  WORKPLACE: 'workplace',
  SETTINGS: 'settings',
  GEOFENCE_STATE: 'geofence_state',
};

export const defaultSettings = {
  hourlyRate: 35,
  breakThresholdMinutes: 30,
  autoStartDelayMinutes: 30,
  geofenceRadius: 500,
  israeliLaw: false,
  israeliStandardHours: 8,   // hours before overtime kicks in (8 or 9)
};

// Settings
export async function getSettings() {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
}
export async function saveSettings(settings) {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// Workplace
export async function getWorkplace() {
  const raw = await AsyncStorage.getItem(KEYS.WORKPLACE);
  return raw ? JSON.parse(raw) : null;
}
export async function saveWorkplace(location) {
  await AsyncStorage.setItem(KEYS.WORKPLACE, JSON.stringify(location));
}

// Active shift
export async function getActiveShift() {
  const raw = await AsyncStorage.getItem(KEYS.ACTIVE_SHIFT);
  return raw ? JSON.parse(raw) : null;
}
export async function saveActiveShift(shift) {
  if (shift === null) {
    await AsyncStorage.removeItem(KEYS.ACTIVE_SHIFT);
  } else {
    await AsyncStorage.setItem(KEYS.ACTIVE_SHIFT, JSON.stringify(shift));
  }
}

// Completed shifts
export async function getShifts() {
  const raw = await AsyncStorage.getItem(KEYS.SHIFTS);
  return raw ? JSON.parse(raw) : [];
}
export async function addShift(shift) {
  const shifts = await getShifts();
  shifts.unshift(shift);
  await AsyncStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts));
}
export async function deleteShift(id) {
  const shifts = await getShifts();
  await AsyncStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts.filter(s => s.id !== id)));
}
export async function updateShift(updated) {
  const shifts = await getShifts();
  await AsyncStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts.map(s => s.id === updated.id ? updated : s)));
}

// Geofence state (persisted so background task can read it)
export async function getGeofenceState() {
  const raw = await AsyncStorage.getItem(KEYS.GEOFENCE_STATE);
  return raw ? JSON.parse(raw) : { insideGeofence: false, arrivedAt: null, leftAt: null };
}
export async function saveGeofenceState(state) {
  await AsyncStorage.setItem(KEYS.GEOFENCE_STATE, JSON.stringify(state));
}
