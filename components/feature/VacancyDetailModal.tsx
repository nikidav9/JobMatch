import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Vacancy } from '@/constants/types';
import { Chip } from '@/components/ui/Chip';
import { formatDate } from '@/services/storage';

interface Props {
  vacancy: Vacancy | null;
  visible: boolean;
  onClose: () => void;
  /** Optional action buttons to render at the bottom */
  actions?: React.ReactNode;
}

export function VacancyDetailModal({ vacancy, visible, onClose, actions }: Props) {
  if (!vacancy) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            bounces={false}
          >
            {/* Company row */}
            <View style={styles.companyRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(vacancy.company[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.company}>{vacancy.company}</Text>
                {vacancy.metroStation ? <Text style={styles.metro}>🚇 {vacancy.metroStation}</Text> : null}
              </View>
              {vacancy.isUrgent ? (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentTxt}>🔥 Срочно</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.jobTitle}>{vacancy.title}</Text>

            {/* Chips: type, time, date */}
            <View style={styles.row}>
              <Chip label="📦 Кладовщик" variant="work" />
              <Chip label={`⏰ ${vacancy.timeStart}–${vacancy.timeEnd}`} variant="time" />
              <Chip label={`📅 ${formatDate(vacancy.date)}`} variant="date" />
            </View>

            {/* Experience */}
            <Text style={styles.secLabel}>Опыт</Text>
            <View style={styles.row}>
              <Chip label={vacancy.noExperienceNeeded ? '🎓 Не требуется' : '🎓 Желателен'} variant={vacancy.noExperienceNeeded ? 'exp' : 'work'} />
            </View>

            {/* Salary */}
            <Text style={styles.secLabel}>Оплата за смену</Text>
            <View style={styles.row}>
              <Chip label={`💰 ${vacancy.salary.toLocaleString('ru')} ₽`} variant="salary" />
            </View>

            {/* Norms */}
            {vacancy.normsAndPay ? (
              <>
                <Text style={styles.secLabel}>Нормативы и оплата</Text>
                <Text style={styles.condText}>{vacancy.normsAndPay}</Text>
              </>
            ) : null}

            {/* Workers */}
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (vacancy.workersFound / vacancy.workersNeeded) * 100)}%` }]} />
              </View>
              <Text style={styles.progressLabel}>
                Набрано {vacancy.workersFound} из {vacancy.workersNeeded} · ⚡ Осталось {Math.max(0, vacancy.workersNeeded - vacancy.workersFound)} мест
              </Text>
            </View>

            {actions ? <View style={styles.actionsWrap}>{actions}</View> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: 12,
  },
  handle: {
    width: 38, height: 4, backgroundColor: Colors.inputBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  closeBtn: {
    position: 'absolute', top: 18, right: 20, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 15, color: Colors.textMuted, fontWeight: '600' },
  body: { padding: 20, paddingTop: 8, gap: 10, paddingBottom: 32 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  company: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  metro: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  urgentBadge: { backgroundColor: '#FEF2F2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  urgentTxt: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  jobTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, lineHeight: 28 },
  secLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  condText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  progressWrap: { marginTop: 8, gap: 6 },
  progressTrack: { height: 4, backgroundColor: Colors.divider, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressLabel: { fontSize: 12, color: Colors.textMuted },
  actionsWrap: { marginTop: 8, gap: 10 },
});
