import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { listening } from '../services/listening';
import { colors } from './theme';

const BAR_COUNT = 36;

function WaveBar({
  index, phase, amplitude, expanded, shift, soft,
}: {
  index: number; phase: SharedValue<number>; amplitude: SharedValue<number>; expanded: SharedValue<number>; shift: number; soft?: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const x = index / (BAR_COUNT - 1);
    const wave = Math.sin(phase.value * 2 + x * Math.PI * 3 + shift) * 0.55
      + Math.sin(phase.value * 3.1 + x * Math.PI * 5.4 + shift * 0.7) * 0.28
      + Math.sin(phase.value * 1.15 + x * Math.PI + shift) * 0.17;
    const envelope = 0.22 + amplitude.value * 0.78;
    const height = 5 + Math.abs(wave) * (soft ? 34 : 44) * envelope;
    return {
      height,
      opacity: interpolate(expanded.value, [0, 0.35, 1], [0, 0, soft ? 0.45 : 0.95]),
      transform: [{ scaleY: interpolate(expanded.value, [0, 1], [0.2, 1]) }],
    };
  });
  return <Animated.View style={[{ flex: 1, marginHorizontal: 0.7, borderRadius: 2, backgroundColor: soft ? colors.waveSoft : (index % 2 === 0 ? colors.wave : colors.waveSoft) }, style]} />;
}

export function ListeningControl({
  listening: live, pending, disabled, onToggle,
}: {
  listening: boolean; pending: boolean; disabled: boolean; onToggle: () => void;
}) {
  const meter = useSyncExternalStore(listening.subscribe, () => listening.snapshot().meter);
  const width = useWindowDimensions().width;
  const expanded = useSharedValue(live ? 1 : 0);
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(0.2);
  const pulse = useSharedValue(1);
  const barWidth = Math.min(width - 48, 342);

  useEffect(() => {
    expanded.value = withSpring(live ? 1 : 0, { damping: 18, stiffness: 160, mass: 0.8 });
  }, [expanded, live]);

  useEffect(() => {
    const peak = meter.length ? Math.max(...meter) : 0;
    amplitude.value = withTiming(live ? Math.min(1, 0.18 + peak * 1.15) : 0.12, { duration: 90 });
  }, [amplitude, live, meter]);

  useEffect(() => {
    if (live) {
      cancelAnimation(pulse);
      pulse.value = 1;
      phase.value = 0;
      phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 2200, easing: Easing.linear }), -1, false);
      return () => { cancelAnimation(phase); };
    }
    cancelAnimation(phase);
    phase.value = withTiming(0, { duration: 200 });
    if (!disabled && !pending) {
      pulse.value = withRepeat(withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
    return () => { cancelAnimation(pulse); };
  }, [disabled, live, pending, phase, pulse]);

  const shell = useAnimatedStyle(() => {
    const size = interpolate(expanded.value, [0, 1], [68, barWidth]);
    return {
      width: size,
      height: interpolate(expanded.value, [0, 1], [68, 68]),
      borderRadius: interpolate(expanded.value, [0, 1], [34, 34]),
      transform: [{ scale: interpolate(expanded.value, [0, 1], [pulse.value, 1]) }],
    };
  });

  const glow = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0, 1], [0, 0.28 + amplitude.value * 0.35]),
    transform: [{ scaleY: 0.45 + amplitude.value * 0.55 }],
  }));

  return <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={live ? 'Stop listening' : 'Start listening'}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      disabled={disabled || pending}
      onPress={onToggle}
      hitSlop={12}
    >
      <Animated.View style={[{
        backgroundColor: colors.control,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.wave,
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }, shell]}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 28, right: 28, height: 22, borderRadius: 11, backgroundColor: colors.wave }, glow]} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 20, right: 16, height: 56, flexDirection: 'row', alignItems: 'center' }}>
          {Array.from({ length: BAR_COUNT }, (_, index) => (
            <WaveBar key={`soft-${index}`} index={index} phase={phase} amplitude={amplitude} expanded={expanded} shift={1.35} soft />
          ))}
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, height: 56, flexDirection: 'row', alignItems: 'center' }}>
          {Array.from({ length: BAR_COUNT }, (_, index) => (
            <WaveBar key={index} index={index} phase={phase} amplitude={amplitude} expanded={expanded} shift={0} />
          ))}
        </View>
      </Animated.View>
    </Pressable>
  </View>;
}
