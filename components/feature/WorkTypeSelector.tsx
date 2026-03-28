import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { WorkType } from '@/constants/types';

// Only stocker is available
const WORK_TYPES: { type: WorkType; emoji: string; title: string; desc: string }[] = [
  { type: 'stocker', emoji: '📦', title: 'Кладовщик', desc: 'Хранение, приёмка и учёт товаров на складе' },
];

interface Props {
  selected: WorkType[];
  onToggle: (t: WorkType) => void;
  single?: boolean;
}

export function WorkTypeSelector({ selected, onToggle, single }: Props) {
  return (
    <View style={styles.container}>
      {WORK_TYPES.map(wt => {
        const isSelected = selected.includes(wt.type);
        return (
          <TouchableOpacity
            key={wt.type}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onToggle(wt.type)}
            activeOpacity={0.8}
          >
            <Text style={styles.emoji}>{wt.emoji}</Text>
            <View style={styles.info}>
              <Text style={styles.title}>{wt.title}</Text>
              <Text style={styles.desc}>{wt.desc}</Text>
            </View>
            <View style={[styles.circle, isSelected && styles.circleSelected]}>
              {isSelected ? <Text style={styles.check}>✓</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    padding: 18,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    ...Shadow.card,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  emoji: { fontSize: 32 },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  desc: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  check: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
