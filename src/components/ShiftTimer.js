import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

export default function ShiftTimer({ startTime, style }) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const totalSecs = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = n => String(n).padStart(2, '0');

  return (
    <Text style={[styles.timer, style]}>
      {pad(hours)}:{pad(mins)}:{pad(secs)}
    </Text>
  );
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 48,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    color: '#1a1a2e',
    letterSpacing: 2,
  },
});
