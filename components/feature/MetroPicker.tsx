import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { METRO_LINES } from '@/constants/metro';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (lineId: string, lineName: string, station: string) => void;
  selectedLineId?: string;
  selectedStation?: string;
}

export function MetroPicker({ visible, onClose, onSelect, selectedLineId, selectedStation }: Props) {
  const [selectedLine, setSelectedLine] = useState<typeof METRO_LINES[0] | null>(null);

  // Сбрасываем выбранную линию каждый раз когда модал открывается
  useEffect(() => {
    if (visible) {
      setSelectedLine(selectedLineId ? METRO_LINES.find(l => l.id === selectedLineId) ?? null : null);
    }
  }, [visible]);

  const handleLineTap = (line: typeof METRO_LINES[0]) => setSelectedLine(line);

  const handleStationTap = (station: string) => {
    if (selectedLine) {
      onSelect(selectedLine.id, selectedLine.name, station);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {!selectedLine ? (
            <>
              <Text style={styles.title}>Выберите линию</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {METRO_LINES.map(line => (
                  <TouchableOpacity key={line.id} style={styles.lineRow} onPress={() => handleLineTap(line)} activeOpacity={0.7}>
                    <View style={[styles.lineDot, { backgroundColor: line.color }]} />
                    <Text style={styles.lineName}>{line.name}</Text>
                    <Text style={styles.arrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => setSelectedLine(null)}>
                <View style={[styles.lineDotSm, { backgroundColor: selectedLine.color }]} />
                <Text style={styles.backLabel}>← {selectedLine.name}</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Выберите станцию</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stationsGrid}>
                {selectedLine.stations.map(st => {
                  const isSelected = st === selectedStation && selectedLine.id === selectedLineId;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.stationChip, isSelected && styles.stationChipActive]}
                      onPress={() => handleStationTap(st)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stationText, isSelected && styles.stationTextActive]}>{st}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: { width: 36, height: 4, backgroundColor: Colors.inputBorder, borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  lineDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  lineDotSm: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  lineName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  arrow: { fontSize: 20, color: Colors.textMuted },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  backLabel: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  stationsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  stationChip: {
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  stationChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary, borderWidth: 1.5 },
  stationText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  stationTextActive: { color: Colors.primary },
  closeBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
  },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
});
