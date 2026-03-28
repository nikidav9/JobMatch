import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

type ChipVariant = 'work' | 'time' | 'metro' | 'exp' | 'salary' | 'urgent' | 'date';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
}

const VARIANT_STYLES: Record<ChipVariant, { bg: string; text: string; fontWeight?: string }> = {
  work:   { bg: '#FFF3ED', text: '#FF6B1A' },
  time:   { bg: '#EFF6FF', text: '#2563EB' },
  metro:  { bg: '#EFF6FF', text: '#2563EB' },
  exp:    { bg: '#F0FDF4', text: '#16A34A' },
  salary: { bg: '#FFF3ED', text: '#FF6B1A', fontWeight: '800' },
  urgent: { bg: '#FEF2F2', text: '#DC2626' },
  date:   { bg: '#F5F3FF', text: '#7C3AED' },
};

export function Chip({ label, variant = 'work' }: ChipProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Text style={[styles.chipText, { color: s.text, fontWeight: (s.fontWeight as any) ?? '600' }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 13,
  },
});
