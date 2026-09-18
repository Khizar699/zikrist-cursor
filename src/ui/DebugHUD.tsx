import { useSyncExternalStore } from 'react';
import { Platform, Text, View } from 'react-native';
import { formatDebugHudLines, snapshotDebugHud, subscribeDebugHud } from '../core/debug-hud';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export function DebugHUD() {
  const snapshot = useSyncExternalStore(subscribeDebugHud, snapshotDebugHud, snapshotDebugHud);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{
    position: 'absolute',
    top: 60,
    left: 16,
    right: 80,
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  }}>
    {formatDebugHudLines(snapshot).map((line, index) => (
      <Text
        key={index}
        numberOfLines={index === 0 ? 2 : 1}
        style={{
          color: '#F4F4F5',
          fontFamily: mono,
          fontSize: index === 0 ? 10 : 11,
          lineHeight: 14,
          writingDirection: index === 0 ? 'rtl' : 'ltr',
        }}
      >
        {line}
      </Text>
    ))}
  </View>;
}
