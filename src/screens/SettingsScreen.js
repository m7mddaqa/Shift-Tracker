import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, saveSettings } from '../services/storage';
import { startGeofencing, isGeofencingActive } from '../services/geofence';

function FieldRow({ label, value, onChangeText, keyboardType = 'numeric', suffix, hint }) {
  return (
    <View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={String(value)}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            selectTextOnFocus
          />
          {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        </View>
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

function ToggleRow({ label, value, onToggle, description }) {
  return (
    <View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: '#e0e0e0', true: '#C4C1FF' }}
          thumbColor={value ? '#6C63FF' : '#f4f3f4'}
        />
      </View>
      {description && <Text style={styles.hint}>{description}</Text>}
    </View>
  );
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    const parsed = {
      hourlyRate: parseFloat(settings.hourlyRate) || 35,
      breakThresholdMinutes: parseInt(settings.breakThresholdMinutes) || 30,
      autoStartDelayMinutes: parseInt(settings.autoStartDelayMinutes) || 30,
      geofenceRadius: parseInt(settings.geofenceRadius) || 500,
      israeliLaw: !!settings.israeliLaw,
      israeliStandardHours: parseInt(settings.israeliStandardHours) || 8,
    };
    await saveSettings(parsed);
    setSettings(parsed);
    setDirty(false);
    const gfOn = await isGeofencingActive();
    if (gfOn) await startGeofencing();
    Alert.alert('Saved', 'Settings updated.');
  };

  if (!settings) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

      {/* Pay */}
      <Text style={styles.section}>PAY</Text>
      <View style={styles.card}>
        <FieldRow
          label="Hourly Rate"
          value={settings.hourlyRate}
          onChangeText={v => update('hourlyRate', v)}
          suffix="₪/hr"
        />
      </View>

      {/* Israeli Law */}
      <Text style={styles.section}>🇮🇱 ISRAELI LABOR LAW</Text>
      <View style={styles.card}>
        <ToggleRow
          label="Enable Israeli overtime"
          value={!!settings.israeliLaw}
          onToggle={v => update('israeliLaw', v)}
          description="Applies legal overtime rates to all shift wage calculations"
        />

        {settings.israeliLaw && (
          <>
            <View style={styles.divider} />
            <FieldRow
              label="Standard hours/day"
              value={settings.israeliStandardHours}
              onChangeText={v => update('israeliStandardHours', v)}
              suffix="hr"
              hint="8 for 6-day week · 9 for 5-day week"
            />
            <View style={styles.divider} />

            {/* Rate table */}
            <Text style={styles.tableTitle}>Overtime rates</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableHours}>Hours 1–{settings.israeliStandardHours}</Text>
                <View style={styles.rateChip}><Text style={styles.rateText}>100% regular</Text></View>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableHours}>Hours {parseInt(settings.israeliStandardHours)+1}–{parseInt(settings.israeliStandardHours)+2}</Text>
                <View style={[styles.rateChip, styles.rateOt1]}><Text style={styles.rateText}>125% overtime</Text></View>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableHours}>Hour {parseInt(settings.israeliStandardHours)+3}+</Text>
                <View style={[styles.rateChip, styles.rateOt2]}><Text style={styles.rateText}>150% overtime</Text></View>
              </View>
              <View style={[styles.tableRow, { marginTop: 6 }]}>
                <Text style={styles.tableHours}>Shabbat / Holiday</Text>
                <View style={[styles.rateChip, styles.rateShabbat]}><Text style={styles.rateText}>150% all hours</Text></View>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#6C63FF" />
              <Text style={styles.infoText}>
                Shabbat is auto-detected on Saturdays and Fridays after 18:00. You can also mark any shift as a holiday manually.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Auto-tracking */}
      <Text style={styles.section}>AUTO-TRACKING RULES</Text>
      <View style={styles.card}>
        <FieldRow
          label="Break threshold"
          value={settings.breakThresholdMinutes}
          onChangeText={v => update('breakThresholdMinutes', v)}
          suffix="min"
          hint="Away less than this = break; more = shift ended at the time you left"
        />
        <View style={styles.divider} />
        <FieldRow
          label="Auto-start delay"
          value={settings.autoStartDelayMinutes}
          onChangeText={v => update('autoStartDelayMinutes', v)}
          suffix="min"
          hint="If no manual start after this long inside geofence, shift auto-starts (backdated to arrival)"
        />
        <View style={styles.divider} />
        <FieldRow
          label="Geofence radius"
          value={settings.geofenceRadius}
          onChangeText={v => update('geofenceRadius', v)}
          suffix="m"
          hint="Distance from workplace to trigger entry/exit events"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!dirty}
      >
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  section: { fontSize: 12, fontWeight: '700', color: '#9e9e9e', letterSpacing: 1.5, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 15, color: '#1a1a2e', flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 16, minWidth: 70, textAlign: 'right', color: '#1a1a2e' },
  suffix: { fontSize: 13, color: '#9e9e9e', minWidth: 30 },
  hint: { fontSize: 12, color: '#9e9e9e', marginTop: 5, lineHeight: 17 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 14 },
  tableTitle: { fontSize: 12, fontWeight: '700', color: '#9e9e9e', letterSpacing: 1, marginBottom: 10 },
  table: { gap: 8 },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tableHours: { fontSize: 14, color: '#424242' },
  rateChip: { backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rateOt1: { backgroundColor: '#FFF3E0' },
  rateOt2: { backgroundColor: '#FCE4EC' },
  rateShabbat: { backgroundColor: '#EDE7F6' },
  rateText: { fontSize: 13, fontWeight: '600', color: '#424242' },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#F4F3FF', borderRadius: 10, padding: 10, marginTop: 14 },
  infoText: { fontSize: 12, color: '#5a5a8a', flex: 1, lineHeight: 17 },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { backgroundColor: '#bdbdbd' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
