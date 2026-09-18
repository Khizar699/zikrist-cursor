import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { content } from './services/content';
import { storage } from './services/storage';
import { listening, type ListeningState } from './services/listening';
import type { Settings } from './core/types';
import { colors, styles as s } from './ui/theme';
import { inter, tajawal } from './ui/fonts';
import { listeningSurface } from './core/salah-liturgy-display';
import { HeardWordPanes, LiturgyPanes, SyncedVersePanes } from './ui/SyncedVersePanes';
import { ListeningControl } from './ui/ListeningControl';
import { DebugHUD } from './ui/DebugHUD';
import { SettingsSheet } from './ui/SettingsSheet';

export default function App() {
  return <GestureHandlerRootView style={s.root}><SafeAreaProvider><Zikrist /></SafeAreaProvider></GestureHandlerRootView>;
}

function useListening<T>(select: (state: ListeningState) => T): T {
  return useSyncExternalStore(listening.subscribe, () => select(listening.snapshot()));
}

function LivePassage({ urdu, ready, displayError }: { urdu: boolean; ready: boolean; displayError: string | null }) {
  const current = useListening((state) => state.current);
  const passage = useListening((state) => state.passage);
  const draftWords = useListening((state) => state.draftWords);
  const liturgy = useListening((state) => state.liturgy);
  const wordProgress = useListening((state) => state.wordProgress);
  const surface = listeningSurface({ liturgy, current, passage, draftWords });
  if (surface.mode === 'liturgy') return <LiturgyPanes liturgy={surface.liturgy} />;
  if (surface.mode === 'heard_words') return <HeardWordPanes words={surface.words} />;
  if (surface.mode === 'passage') {
    return <SyncedVersePanes verses={surface.passage} focus={surface.current} urdu={urdu} wordProgress={wordProgress} />;
  }
  return <View style={[s.panes, { justifyContent: 'center', alignItems: 'center' }]}>
    {!ready && !displayError ? <ActivityIndicator color={colors.muted} /> : null}
  </View>;
}

function Zikrist() {
  const [fontsLoaded, fontError] = useFonts({ Inter: inter, Tajawal: tajawal });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const status = useListening((state) => state.status);
  const listenError = useListening((state) => state.error);
  const live = status === 'listening';
  const pending = status === 'loading' || status === 'starting' || status === 'stopping';
  const debugHud = settings?.debugHud ?? __DEV__;

  useEffect(() => {
    void (async () => {
      try {
        await storage.init();
        const saved = await storage.settings();
        const language = saved.language ?? 'en';
        const next: Settings = { language };
        if (typeof saved.debugHud === 'boolean') next.debugHud = saved.debugHud;
        if (!saved.language) await storage.saveSettings(next);
        setSettings(next);
        await listening.prepare();
        await content.activate(language);
        setReady(true);
      } catch (caught) {
        setError(String(caught));
        setReady(true);
      }
    })();
  }, []);

  const displayError = error ?? fontError?.message ?? listenError;
  const fontsReady = fontsLoaded || !!fontError;
  const canListen = ready && fontsReady && !!settings?.language && content.language === settings.language;

  function toggle(): void {
    if (!settings || pending) return;
    if (live) { void listening.stop(); return; }
    setError(null);
    void listening.start().catch((caught) => setError(String(caught)));
  }

  function saveDebugHud(enabled: boolean): void {
    if (!settings) return;
    const next: Settings = { ...settings, debugHud: enabled };
    setSettings(next);
    void storage.saveSettings(next);
  }

  return <View style={s.screen}>
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {!fontsReady || !settings ? <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={colors.arabic} /></View> : <>
        <LivePassage urdu={settings.language === 'ur'} ready={ready} displayError={displayError} />
        <View style={s.footer}>
          {!!displayError && <Text style={s.error}>{displayError}</Text>}
          <ListeningControl
            listening={live}
            pending={pending}
            disabled={!canListen && !live}
            onToggle={toggle}
          />
          <Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Open settings" hitSlop={8}>
            <Text style={s.settingsLink}>Settings</Text>
          </Pressable>
        </View>
      </>}
    </SafeAreaView>
    {debugHud ? <DebugHUD /> : null}
    <SettingsSheet
      visible={settingsOpen}
      debugHud={debugHud}
      onClose={() => setSettingsOpen(false)}
      onToggleDebugHud={saveDebugHud}
    />
  </View>;
}
