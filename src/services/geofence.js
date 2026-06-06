import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { handleGeofenceEnter, handleGeofenceExit, checkAutoEnd, checkAutoStart } from './shiftManager';
import { getWorkplace, getSettings } from './storage';

export const GEOFENCE_TASK = 'SHIFT_GEOFENCE_TASK';

// Register background task — must be called at module level (top of app)
TaskManager.defineTask(GEOFENCE_TASK, async ({ data: { eventType, region }, error }) => {
  if (error) return;
  if (eventType === Location.GeofencingEventType.Enter) {
    await handleGeofenceEnter();
    await checkAutoStart();
  } else if (eventType === Location.GeofencingEventType.Exit) {
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
  const settings = await getSettings();

  const already = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (already) await Location.stopGeofencingAsync(GEOFENCE_TASK);

  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: 'workplace',
      latitude: workplace.latitude,
      longitude: workplace.longitude,
      radius: settings.geofenceRadius,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
  return true;
}

export async function stopGeofencing() {
  const active = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (active) await Location.stopGeofencingAsync(GEOFENCE_TASK);
}

export async function isGeofencingActive() {
  return Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
}

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}
