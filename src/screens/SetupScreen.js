import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { getWorkplace, saveWorkplace, getSettings } from '../services/storage';
import { getCurrentLocation, startGeofencing, requestPermissions, stopGeofencing, isGeofencingActive } from '../services/geofence';

export default function SetupScreen() {
  const [workplace, setWorkplace] = useState(null);
  const [settings, setSettings] = useState(null);
  const [geofenceOn, setGeofenceOn] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [wp, s, gf] = await Promise.all([getWorkplace(), getSettings(), isGeofencingActive()]);
      setWorkplace(wp);
      setSettings(s);
      setGeofenceOn(gf);
    })();
  }, []);

  const handleSetCurrentLocation = async () => {
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      if (!loc) { Alert.alert('Permission denied', 'Location permission is required.'); return; }
      const wp = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      await saveWorkplace(wp);
      setWorkplace(wp);
      Alert.alert('Saved', 'Workplace set to your current location.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGeofence = async () => {
    if (geofenceOn) {
      await stopGeofencing();
      setGeofenceOn(false);
    } else {
      if (!workplace) { Alert.alert('Set workplace first', 'Use the button above to set your workplace location.'); return; }
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Background permission needed',
          'Go to phone Settings → ShiftTracker → Location → Always, then come back.'
        );
        return;
      }
      const ok = await startGeofencing();
      setGeofenceOn(ok);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.section}>WORKPLACE LOCATION</Text>

      {workplace ? (
        <View style={styles.card}>
          <Text style={styles.label}>LATITUDE</Text>
          <Text style={styles.value}>{workplace.latitude.toFixed(6)}</Text>
          <Text style={[styles.label, { marginTop: 8 }]}>LONGITUDE</Text>
          <Text style={styles.value}>{workplace.longitude.toFixed(6)}</Text>
          <Text style={styles.radius}>Geofence radius: {settings?.geofenceRadius ?? 500}m</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.empty}>No workplace set yet.</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={handleSetCurrentLocation} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Use Current Location as Workplace</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>Go to your workplace and tap the button above to save that location.</Text>

      <Text style={[styles.section, { marginTop: 32 }]}>AUTO-TRACKING</Text>
      <TouchableOpacity style={[styles.btn, geofenceOn ? styles.btnRed : styles.btnGreen]} onPress={handleToggleGeofence}>
        <Text style={styles.btnText}>{geofenceOn ? 'Disable Auto-Tracking' : 'Enable Auto-Tracking'}</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.label}>HOW IT WORKS</Text>
        <Text style={styles.info}>• Arrive within {settings?.geofenceRadius ?? 500}m of workplace → arrival time is noted</Text>
        <Text style={styles.info}>• If you don't start manually after {settings?.autoStartDelayMinutes ?? 30} min → shift auto-starts (backdated)</Text>
        <Text style={styles.info}>• Leave workplace → timer starts</Text>
        <Text style={styles.info}>• Back within {settings?.breakThresholdMinutes ?? 30} min → treated as a break</Text>
        <Text style={styles.info}>• Away {settings?.breakThresholdMinutes ?? 30}+ min → shift ends at the exact time you left</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  section: { fontSize: 12, fontWeight: '700', color: '#9e9e9e', letterSpacing: 1.5, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  label: { fontSize: 10, fontWeight: '700', color: '#9e9e9e', letterSpacing: 1 },
  value: { fontSize: 16, color: '#1a1a2e', marginTop: 2 },
  radius: { marginTop: 12, fontSize: 13, color: '#9e9e9e' },
  empty: { color: '#9e9e9e', fontSize: 15 },
  btn: { borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnBlue: { backgroundColor: '#6C63FF' },
  btnGreen: { backgroundColor: '#4CAF50' },
  btnRed: { backgroundColor: '#e53935' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 13, color: '#9e9e9e', textAlign: 'center', marginBottom: 8 },
  info: { fontSize: 13, color: '#424242', marginTop: 6, lineHeight: 20 },
});
