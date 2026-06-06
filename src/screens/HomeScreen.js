import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ShiftTimer from '../components/ShiftTimer';
import {
  getActiveShift, getWorkplace, getSettings, getGeofenceState,
} from '../services/storage';
import {
  startShift, endShift, checkAutoEnd, checkAutoStart, formatDuration, calcWage,
} from '../services/shiftManager';
import { isGeofencingActive, startGeofencing, requestPermissions } from '../services/geofence';

export default function HomeScreen({ navigation }) {
  const [activeShift, setActiveShift] = useState(null);
  const [workplace, setWorkplace] = useState(null);
  const [settings, setSettings] = useState(null);
  const [geofenceOn, setGeofenceOn] = useState(false);
  const [geofenceState, setGeofenceState] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [shift, wp, s, gfOn, gfState] = await Promise.all([
      getActiveShift(),
      getWorkplace(),
      getSettings(),
      isGeofencingActive(),
      getGeofenceState(),
    ]);
    setActiveShift(shift);
    setWorkplace(wp);
    setSettings(s);
    setGeofenceOn(gfOn);
    setGeofenceState(gfState);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // Check immediately on focus + poll every 15s
  const runChecks = useCallback(async () => {
    const ended = await checkAutoEnd();
    if (ended.ended) {
      setActiveShift(null);
      Alert.alert('Shift ended', `Auto-ended at ${new Date(ended.endTime).toLocaleTimeString()}`);
      return;
    }
    const started = await checkAutoStart();
    if (started) {
      setActiveShift(started);
      Alert.alert('Shift auto-started', `Backdated to your arrival at ${new Date(started.startTime).toLocaleTimeString()}`);
    } else {
      const shift = await getActiveShift();
      setActiveShift(shift);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    runChecks();
    const interval = setInterval(runChecks, 15000);
    return () => clearInterval(interval);
  }, [runChecks]));

  const handleStartShift = async () => {
    if (!workplace) {
      Alert.alert('No workplace set', 'Go to the Setup tab and set your workplace location first.');
      return;
    }
    const shift = await startShift();
    setActiveShift(shift);
  };

  const handleEndShift = () => {
    Alert.alert('End shift?', 'Are you sure you want to clock out now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End shift', style: 'destructive', onPress: async () => {
          await endShift(Date.now(), true);
          setActiveShift(null);
        },
      },
    ]);
  };

  const handleEnableGeofence = async () => {
    if (!workplace) {
      Alert.alert('Set workplace first', 'Go to the Setup tab and pick your workplace location.');
      return;
    }
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert('Permission needed', 'Background location permission is required for auto-tracking.');
      return;
    }
    const ok = await startGeofencing();
    if (ok) setGeofenceOn(true);
  };

  const shiftDuration = activeShift
    ? Date.now() - activeShift.startTime
    : null;

  const wage = activeShift && settings
    ? calcWage(Date.now() - activeShift.startTime, settings.hourlyRate)
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {/* Status pill */}
      <View style={[styles.statusPill, activeShift ? styles.pillActive : styles.pillIdle]}>
        <Text style={styles.statusText}>{activeShift ? 'ON SHIFT' : 'OFF SHIFT'}</Text>
      </View>

      {/* Timer */}
      {activeShift ? (
        <View style={styles.timerBlock}>
          <ShiftTimer startTime={activeShift.startTime} />
          {activeShift.autoStarted && (
            <Text style={styles.hint}>Auto-started · arrived {new Date(activeShift.startTime).toLocaleTimeString()}</Text>
          )}
          <Text style={styles.wage}>₪{wage}</Text>
        </View>
      ) : (
        <View style={styles.timerBlock}>
          <Text style={styles.idleText}>Not clocked in</Text>
          {geofenceState?.insideGeofence && (
            <Text style={styles.hint}>You're at your workplace · auto-start pending</Text>
          )}
        </View>
      )}

      {/* Main action button */}
      {activeShift ? (
        <TouchableOpacity style={[styles.btn, styles.btnEnd]} onPress={handleEndShift}>
          <Text style={styles.btnText}>End Shift</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.btn, styles.btnStart]} onPress={handleStartShift}>
          <Text style={styles.btnText}>Start Shift</Text>
        </TouchableOpacity>
      )}

      {/* Auto-tracking card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Auto-Tracking</Text>
        <View style={styles.row}>
          <View style={[styles.dot, geofenceOn ? styles.dotGreen : styles.dotGray]} />
          <Text style={styles.cardText}>{geofenceOn ? 'Active — monitoring workplace' : 'Inactive'}</Text>
        </View>
        {!geofenceOn && (
          <TouchableOpacity style={styles.linkBtn} onPress={handleEnableGeofence}>
            <Text style={styles.linkText}>Enable auto-tracking</Text>
          </TouchableOpacity>
        )}
        {!workplace && (
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Setup')}>
            <Text style={styles.linkText}>Set workplace location →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Rate card */}
      {settings && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hourly Rate</Text>
          <Text style={styles.cardValue}>₪{settings.hourlyRate}/hr</Text>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.linkText}>Change in Settings →</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', backgroundColor: '#f5f6fa', padding: 24, paddingTop: 40 },
  statusPill: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20, marginBottom: 32 },
  pillActive: { backgroundColor: '#4CAF50' },
  pillIdle: { backgroundColor: '#9e9e9e' },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1.5 },
  timerBlock: { alignItems: 'center', marginBottom: 40 },
  idleText: { fontSize: 40, fontWeight: '200', color: '#9e9e9e' },
  hint: { fontSize: 13, color: '#757575', marginTop: 8 },
  wage: { fontSize: 22, color: '#4CAF50', fontWeight: '600', marginTop: 12 },
  btn: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 32, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  btnStart: { backgroundColor: '#6C63FF' },
  btnEnd: { backgroundColor: '#e53935' },
  btnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#9e9e9e', letterSpacing: 1, marginBottom: 8 },
  cardText: { fontSize: 15, color: '#1a1a2e' },
  cardValue: { fontSize: 22, fontWeight: '600', color: '#1a1a2e' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: '#4CAF50' },
  dotGray: { backgroundColor: '#bdbdbd' },
  linkBtn: { marginTop: 10 },
  linkText: { color: '#6C63FF', fontSize: 14 },
});
