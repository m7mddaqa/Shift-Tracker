import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Alert, TouchableOpacity,
  Modal, ScrollView, Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getShifts, deleteShift, getSettings, addShift, updateShift } from '../services/storage';
import { formatDuration, calcWage, calcWageForShift, isShabbat, generateId } from '../services/shiftManager';

// ─── Shared Shift Modal (Add + Edit) ─────────────────────────────────────────
function ShiftModal({ visible, onClose, onSave, israeliLaw, existing }) {
  const isEdit = !!existing;

  const defaultStart = () => {
    if (existing) return new Date(existing.startTime);
    const d = new Date(); d.setHours(9, 0, 0, 0); return d;
  };
  const defaultEnd = () => {
    if (existing) return new Date(existing.endTime);
    const d = new Date(); d.setHours(17, 0, 0, 0); return d;
  };

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [picking, setPicking] = useState(null);
  const [isHoliday, setIsHoliday] = useState(existing?.shabbat ?? false);
  // null = follow global setting, true = force on, false = force off
  const [israeliOverride, setIsraeliOverride] = useState(existing?.israeliOverride ?? null);

  React.useEffect(() => {
    if (visible) {
      setStartDate(defaultStart());
      setEndDate(defaultEnd());
      setIsHoliday(existing?.shabbat ?? false);
      setIsraeliOverride(existing?.israeliOverride ?? null);
      setPicking(null);
    }
  }, [visible, existing?.id]);

  const fmt = (d) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const openPicker = (type) => setPicking(type);

  const onPickerChange = (event, selected) => {
    if (event.type === 'dismissed') { setPicking(null); return; }
    if (!selected) return;
    const base = picking.startsWith('start') ? new Date(startDate) : new Date(endDate);
    let next;
    if (picking.endsWith('Date')) {
      next = new Date(selected);
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    } else {
      next = new Date(base);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    if (picking.startsWith('start')) setStartDate(next);
    else setEndDate(next);
    setPicking(null);
  };

  const autoShabbat = isShabbat(startDate.getTime());
  const shabbatFinal = isHoliday || autoShabbat;

  const handleSave = () => {
    if (endDate <= startDate) {
      Alert.alert('Invalid times', 'End time must be after start time.');
      return;
    }
    const base = existing ?? { id: generateId(), breaks: [], manual: true };
    onSave({ ...base, startTime: startDate.getTime(), endTime: endDate.getTime(), shabbat: shabbatFinal, israeliOverride });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={modal.title}>{isEdit ? 'Edit Shift' : 'Add Shift'}</Text>

          <Text style={modal.section}>START</Text>
          <View style={modal.row}>
            <TouchableOpacity style={modal.pill} onPress={() => openPicker('startDate')}>
              <Ionicons name="calendar-outline" size={16} color="#6C63FF" />
              <Text style={modal.pillText}>{fmt(startDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.pill} onPress={() => openPicker('startTime')}>
              <Ionicons name="time-outline" size={16} color="#6C63FF" />
              <Text style={modal.pillText}>{fmtTime(startDate)}</Text>
            </TouchableOpacity>
          </View>

          <Text style={modal.section}>END</Text>
          <View style={modal.row}>
            <TouchableOpacity style={modal.pill} onPress={() => openPicker('endDate')}>
              <Ionicons name="calendar-outline" size={16} color="#6C63FF" />
              <Text style={modal.pillText}>{fmt(endDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.pill} onPress={() => openPicker('endTime')}>
              <Ionicons name="time-outline" size={16} color="#6C63FF" />
              <Text style={modal.pillText}>{fmtTime(endDate)}</Text>
            </TouchableOpacity>
          </View>

          {endDate > startDate && (
            <View style={modal.preview}>
              <Text style={modal.previewText}>{formatDuration(endDate - startDate)}</Text>
            </View>
          )}

          {/* Israeli law toggles — always shown so user can override per shift */}
          <View style={modal.israeliSection}>
            <Text style={modal.israeliSectionTitle}>🇮🇱 Israeli Law</Text>

            {/* Override global Israeli overtime setting */}
            <View style={modal.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={modal.toggleLabel}>Israeli overtime rates</Text>
                <Text style={modal.toggleHint}>
                  {israeliOverride === null
                    ? `Following global setting (${israeliLaw ? 'ON' : 'OFF'})`
                    : israeliOverride ? '125% / 150% tiers active' : 'Disabled for this shift'}
                </Text>
              </View>
              <View style={modal.triState}>
                <TouchableOpacity
                  style={[modal.triBtn, israeliOverride === false && modal.triBtnActive]}
                  onPress={() => setIsraeliOverride(false)}
                >
                  <Text style={[modal.triBtnText, israeliOverride === false && modal.triBtnTextActive]}>Off</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modal.triBtn, israeliOverride === null && modal.triBtnNeutral]}
                  onPress={() => setIsraeliOverride(null)}
                >
                  <Text style={[modal.triBtnText, israeliOverride === null && modal.triBtnTextNeutral]}>Auto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modal.triBtn, israeliOverride === true && modal.triBtnActive]}
                  onPress={() => setIsraeliOverride(true)}
                >
                  <Text style={[modal.triBtnText, israeliOverride === true && modal.triBtnTextActive]}>On</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Shabbat / Holiday — flat 150%, replaces tiered */}
            {(israeliOverride === true || (israeliOverride === null && israeliLaw)) && (
              <View style={[modal.toggleRow, { marginTop: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={modal.toggleLabel}>Shabbat / Holiday</Text>
                  <Text style={modal.toggleHint}>
                    {autoShabbat ? 'Auto-detected · ' : ''}150% base + overtime on top (187.5% / 225%)
                  </Text>
                </View>
                <Switch
                  value={shabbatFinal}
                  onValueChange={v => setIsHoliday(v)}
                  trackColor={{ false: '#e0e0e0', true: '#C4C1FF' }}
                  thumbColor={shabbatFinal ? '#6C63FF' : '#f4f3f4'}
                  disabled={autoShabbat}
                />
              </View>
            )}
          </View>

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.saveBtn} onPress={handleSave}>
              <Text style={modal.saveText}>{isEdit ? 'Save Changes' : 'Save Shift'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {picking && (
        <DateTimePicker
          value={picking.startsWith('start') ? startDate : endDate}
          mode={picking.endsWith('Date') ? 'date' : 'time'}
          is24Hour
          display="default"
          onChange={onPickerChange}
        />
      )}
    </Modal>
  );
}

// ─── Shift Row ────────────────────────────────────────────────────────────────
function ShiftRow({ shift, settings, onDelete, onEdit }) {
  const duration = shift.endTime - shift.startTime;
  const date = new Date(shift.startTime);
  const { total, breakdown } = calcWageForShift(shift, settings);
  const shabbatDetected = shift.shabbat ?? isShabbat(shift.startTime);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.date}>
          {date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
        <View style={styles.badges}>
          {shabbatDetected && settings.israeliLaw && <View style={styles.shabbatBadge}><Text style={styles.shabbatBadgeText}>שבת</Text></View>}
          {shift.manual && <View style={styles.manualBadge}><Text style={styles.manualBadgeText}>Manual</Text></View>}
          {shift.autoStarted && <View style={styles.autoBadge}><Text style={styles.autoBadgeText}>Auto</Text></View>}
          <TouchableOpacity onPress={onEdit} style={styles.deleteBtn}>
            <Ionicons name="pencil-outline" size={16} color="#9e9e9e" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color="#bdbdbd" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.timeBlock}>
          <Text style={styles.label}>START</Text>
          <Text style={styles.time}>{new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#bdbdbd" style={{ marginTop: 14 }} />
        <View style={styles.timeBlock}>
          <Text style={styles.label}>END</Text>
          <Text style={styles.time}>{new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={[styles.timeBlock, styles.right]}>
          <Text style={styles.label}>DURATION</Text>
          <Text style={styles.time}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Israeli law breakdown */}
      {breakdown && (
        <View style={styles.breakdown}>
          {breakdown.shabbat && (
            <Text style={styles.bdShabbat}>שבת/חג — base rate 150%</Text>
          )}
          {breakdown.regularHours > 0 && (
            <Text style={styles.bdRow}>
              <Text style={styles.bdLabel}>Regular  </Text>
              {breakdown.regularHours}h × {breakdown.shabbat ? '150%' : '100%'}
            </Text>
          )}
          {breakdown.ot1Hours > 0 && (
            <Text style={[styles.bdRow, styles.bdOt1]}>
              <Text style={styles.bdLabel}>Overtime  </Text>
              {breakdown.ot1Hours}h × {breakdown.shabbat ? '187.5%' : '125%'}
            </Text>
          )}
          {breakdown.ot2Hours > 0 && (
            <Text style={[styles.bdRow, styles.bdOt2]}>
              <Text style={styles.bdLabel}>Overtime+  </Text>
              {breakdown.ot2Hours}h × {breakdown.shabbat ? '225%' : '150%'}
            </Text>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.wage}>₪{total}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const [allShifts, setAllShifts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const [showAdd, setShowAdd] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [s, st] = await Promise.all([getShifts(), getSettings()]);
      setAllShifts(s);
      setSettings(st);
    })();
  }, []));

  // Month navigation
  const viewDate = new Date();
  viewDate.setMonth(viewDate.getMonth() + monthOffset);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const monthShifts = allShifts.filter(s => {
    const d = new Date(s.startTime);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });

  const monthTotal = monthShifts.reduce((acc, s) => acc + (s.endTime - s.startTime), 0);
  const safeSettings = settings ?? { hourlyRate: 35, israeliLaw: false, israeliStandardHours: 8 };
  const monthWageTotal = monthShifts.reduce((acc, s) => acc + parseFloat(calcWageForShift(s, safeSettings).total), 0).toFixed(2);

  const monthLabel = viewDate.toLocaleDateString('en-IL', { month: 'long', year: 'numeric' });
  const isCurrentMonth = monthOffset === 0;

  const handleDelete = (id) => {
    Alert.alert('Delete shift?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteShift(id);
          setAllShifts(prev => prev.filter(s => s.id !== id));
        },
      },
    ]);
  };

  const handleAddShift = async (shift) => {
    await addShift(shift);
    setAllShifts(prev => [shift, ...prev].sort((a, b) => b.startTime - a.startTime));
    const d = new Date(shift.startTime);
    const now = new Date();
    setMonthOffset((d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
  };

  const handleEditShift = async (updated) => {
    await updateShift(updated);
    setAllShifts(prev => prev.map(s => s.id === updated.id ? updated : s));
    setEditingShift(null);
  };

  return (
    <View style={styles.container}>
      {/* Month header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity style={styles.arrow} onPress={() => setMonthOffset(o => o - 1)}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.monthCenter}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Text style={styles.monthHours}>{formatDuration(monthTotal)}</Text>
          {settings && <Text style={styles.monthWage}>₪{monthWageTotal}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.arrow, isCurrentMonth && styles.arrowDisabled]}
          onPress={() => !isCurrentMonth && setMonthOffset(o => o + 1)}
        >
          <Ionicons name="chevron-forward" size={22} color={isCurrentMonth ? 'rgba(255,255,255,0.3)' : '#fff'} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={monthShifts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ShiftRow
            shift={item}
            settings={safeSettings}
            onDelete={() => handleDelete(item.id)}
            onEdit={() => setEditingShift(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={48} color="#e0e0e0" />
            <Text style={styles.empty}>No shifts this month</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 100 }}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <ShiftModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleAddShift}
        israeliLaw={!!settings?.israeliLaw}
      />
      <ShiftModal
        visible={!!editingShift}
        onClose={() => setEditingShift(null)}
        onSave={handleEditShift}
        israeliLaw={!!settings?.israeliLaw}
        existing={editingShift}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  monthHeader: { backgroundColor: '#6C63FF', flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  arrowDisabled: { opacity: 0.3 },
  monthCenter: { flex: 1, alignItems: 'center' },
  monthLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
  monthHours: { color: 'rgba(255,255,255,0.9)', fontSize: 28, fontWeight: '200', marginTop: 2 },
  monthWage: { color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  manualBadge: { backgroundColor: '#EDE9FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  manualBadgeText: { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  autoBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  autoBadgeText: { color: '#1565C0', fontSize: 11, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timeBlock: { flex: 1 },
  right: { alignItems: 'flex-end' },
  label: { fontSize: 10, color: '#9e9e9e', fontWeight: '700', letterSpacing: 1 },
  time: { fontSize: 16, fontWeight: '500', color: '#1a1a2e', marginTop: 2 },
  footer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  wage: { fontSize: 18, fontWeight: '600', color: '#4CAF50' },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 12 },
  empty: { color: '#bdbdbd', fontSize: 15 },
  shabbatBadge: { backgroundColor: '#EDE7F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  shabbatBadgeText: { color: '#7B1FA2', fontSize: 11, fontWeight: '700' },
  breakdown: { backgroundColor: '#f8f8fc', borderRadius: 10, padding: 10, marginTop: 10, gap: 4 },
  bdShabbat: { fontSize: 11, fontWeight: '700', color: '#7B1FA2', marginBottom: 4 },
  bdRow: { fontSize: 12, color: '#666' },
  bdLabel: { fontWeight: '700', color: '#444' },
  bdOt1: { color: '#E65100' },
  bdOt2: { color: '#B71C1C' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#6C63FF', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 20 },
  section: { fontSize: 11, fontWeight: '700', color: '#9e9e9e', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F4F3FF', borderRadius: 12, padding: 12 },
  pillText: { fontSize: 14, color: '#6C63FF', fontWeight: '600' },
  preview: { backgroundColor: '#f5f6fa', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 20 },
  previewText: { fontSize: 22, fontWeight: '200', color: '#1a1a2e' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelText: { color: '#9e9e9e', fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#6C63FF', alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  israeliSection: { backgroundColor: '#F4F3FF', borderRadius: 14, padding: 14, marginBottom: 16 },
  israeliSectionTitle: { fontSize: 12, fontWeight: '700', color: '#6C63FF', letterSpacing: 1, marginBottom: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  toggleHint: { fontSize: 11, color: '#9e9e9e', marginTop: 2 },
  triState: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
  triBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  triBtnActive: { backgroundColor: '#6C63FF' },
  triBtnNeutral: { backgroundColor: '#e8e8ff' },
  triBtnText: { fontSize: 12, fontWeight: '600', color: '#9e9e9e' },
  triBtnTextActive: { color: '#fff' },
  triBtnTextNeutral: { color: '#6C63FF' },
  holidayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F4F3FF', borderRadius: 12, padding: 12, marginBottom: 16 },
  holidayLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  holidayHint: { fontSize: 12, color: '#9e9e9e', marginTop: 2 },
});
