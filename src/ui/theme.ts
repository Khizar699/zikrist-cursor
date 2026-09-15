import { StyleSheet } from 'react-native';

export const colors = {
  canvas: '#F3F1F7',
  arabic: '#1A1430',
  translation: '#8A8496',
  control: '#070B16',
  wave: '#6BA3FF',
  waveSoft: '#C5DAFF',
  muted: '#A39EAE',
  danger: '#A34739',
};

export const fonts = {
  arabic: 'Tajawal',
  translation: 'Inter',
};

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  screen: { flex: 1, backgroundColor: colors.canvas },
  panes: { flex: 1 },
  pane: { flex: 1 },
  verseList: { flexGrow: 1 },
  verseRow: { paddingHorizontal: 28, paddingVertical: 18, gap: 12 },
  arabic: {
    fontFamily: fonts.arabic,
    fontSize: 40,
    lineHeight: 62,
    color: colors.arabic,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  translation: {
    fontFamily: fonts.translation,
    fontSize: 32,
    lineHeight: 46,
    color: colors.translation,
    textAlign: 'center',
    fontWeight: '500',
  },
  liturgyLabel: {
    fontFamily: fonts.translation,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  liturgyCategory: {
    fontFamily: fonts.translation,
    fontSize: 15,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '500',
  },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 28, paddingBottom: 10 },
  footer: { alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 10, minHeight: 96 },
});
