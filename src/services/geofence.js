import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { handleGeofenceEnter, handleGeofenceExit, checkAutoEnd, checkAutoStart } from './shiftManager';
import { getWorkplace, getSettings, getGeofenceState } from './storage';

export const LOCATION_TASK = 'SHIFT_LOCATION_TASK';

// Haversine formula — distance in metres between two coordinates
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Background + foreground service task — runs even when app is force-closed
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;

  const workplace = await getWorkplace();
  if (!workplace) return;

  const settings = await getSettings();
  const { latitude, longitude } = data.locations[0].coords;
  const distance = getDistance(latitude, longitude, workplace.latitude, workplace.longitude);
  const inside = distance <= settings.geofenceRadius;

  const state = await getGeofenceState();

  if (inside && !state.insideGeofence) {
    await handleGeofenceEnter();
    await checkAutoStart();
  } else if (!inside && state.insideGeofence) {
    await handleGeofenceExit();
    await checkAutoEnd();
  }
});

export async function requestPermissions() {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  return bg === 'granted';
}

export async function startGeofencing() {
  const workplace = await getWorkplace();
  if (!workplace) return false;

  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (already) await Location.stopLocationUpdatesAsync(LOCATION_TASK);

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60000,       // check every 60 seconds
    distanceInterval: 30,      // or every 30 metres moved
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'ShiftTracker',
      notificationBody: 'Monitoring your workplace — auto shift tracking active',
      notificationColor: '#6C63FF',
    },
    // Keep running when app is killed
    showsBackgroundLocationIndicator: true,
  });
  return true;
}

export async function stopGeofencing() {
  const active = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (active) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}

export async function isGeofencingActive() {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}
