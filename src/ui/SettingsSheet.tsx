import { Modal, Pressable, Switch, Text, View } from 'react-native';
import { colors, fonts } from './theme';

export function SettingsSheet({
  visible, debugHud, onClose, onToggleDebugHud,
}: {
  visible: boolean;
  debugHud: boolean;
  onClose: () => void;
  onToggleDebugHud: (enabled: boolean) => void;
}) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 }}>
      <Text style={{ fontFamily: fonts.translation, fontSize: 22, fontWeight: '600', color: colors.arabic, marginBottom: 24 }}>
        Settings
      </Text>
      <Text style={{ fontFamily: fonts.translation, fontSize: 13, color: colors.muted, letterSpacing: 0.4, marginBottom: 10 }}>
        DEBUG
      </Text>
      <View style={{
        backgroundColor: '#EBE7F0',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontFamily: fonts.translation, fontSize: 16, color: colors.arabic, fontWeight: '500' }}>
            Debug HUD
          </Text>
          <Text style={{ fontFamily: fonts.translation, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 4 }}>
            Live ASR, inference/match latency, lock vs candidate, and search space. Simulator diagnostics only.
          </Text>
        </View>
        <Switch
          value={debugHud}
          onValueChange={onToggleDebugHud}
          accessibilityLabel="Show debug HUD"
        />
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close settings"
        style={{ marginTop: 28, alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 }}
      >
        <Text style={{ fontFamily: fonts.translation, fontSize: 16, color: colors.arabic, fontWeight: '500' }}>Done</Text>
      </Pressable>
    </View>
  </Modal>;
}
