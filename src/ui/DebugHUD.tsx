import { useSyncExternalStore } from 'react';
import { Platform, Text, View } from 'react-native';
import { formatDebugHudLines, snapshotDebugHud, subscribeDebugHud } from '../core/debug-hud';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export function DebugHUD() {
  const snapshot = useSyncExternalStore(subscribeDebugHud, snapshotDebugHud, snapshotDebugHud);
  const lines = formatDebugHudLines(snapshot);
  const asrIndex = lines.length - 1;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{
    marginTop: 4,
    marginBottom: 4,
    marginHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  }}>
    {lines.map((line, index) => (
      <Text
        key={index}
        numberOfLines={index === asrIndex ? 2 : 1}
        style={{
          color: '#F4F4F5',
          fontFamily: mono,
          fontSize: index === asrIndex ? 10 : 11,
          lineHeight: 14,
        }}
      >
        {line}
      </Text>
    ))}
  </View>;
}
