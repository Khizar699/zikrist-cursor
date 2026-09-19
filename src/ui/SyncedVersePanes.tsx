import { useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import {
  CONTEXT_OPACITY, FOCUSED_SCROLL_POSITION, SHOW_TRANSLATION_PANE,
  passageIndex, passagePanePadding,
} from '../core/passage';
import type { LiturgyDisplay } from '../core/salah-liturgy-display';
import { highlightHeardWordCount, splitDisplayWords } from '../core/word-highlight';
import { refKey, type DisplayVerse, type WordProgress } from '../core/types';
import { fonts, styles as s } from './theme';

type Pane = 'arabic' | 'translation';

function scrollToAyah(list: FlatList<DisplayVerse> | null, index: number, animated: boolean): void {
  if (!list || index < 0) return;
  list.scrollToIndex({ index, animated, viewPosition: FOCUSED_SCROLL_POSITION });
}

function ArabicVerseText({ arabic, heard }: { arabic: string; heard: number }) {
  const words = splitDisplayWords(arabic);
  if (!words.length) return null;
  if (heard <= 0) {
    return <Text selectable style={[s.arabic, s.arabicUnread]}>{arabic}</Text>;
  }
  if (heard >= words.length) {
    return <Text selectable style={s.arabic}>{arabic}</Text>;
  }
  return <Text selectable style={s.arabic}>
    {words.map((word, index) => (
      <Text key={`${index}-${word}`} style={index < heard ? undefined : s.arabicUnread}>
        {index > 0 ? ' ' : ''}{word}
      </Text>
    ))}
  </Text>;
}

function heardFor(verse: DisplayVerse, progress: WordProgress | null): number {
  if (!progress || verse.surah !== progress.surah || verse.ayah !== progress.ayah) return 0;
  return highlightHeardWordCount(splitDisplayWords(verse.arabic).length, progress.wordIndex, progress.totalWords);
}

function VersePane({
  pane, verses, focusKey, urdu, padding, index, wordProgress,
}: {
  pane: Pane;
  verses: DisplayVerse[];
  focusKey: string;
  urdu: boolean;
  padding: number;
  index: number;
  wordProgress: WordProgress | null;
}) {
  const list = useRef<FlatList<DisplayVerse>>(null);
  const lastFocus = useRef<string | null>(null);
  const progressKey = wordProgress ? `${wordProgress.surah}:${wordProgress.ayah}:${wordProgress.wordIndex}` : '';

  useEffect(() => {
    const animated = lastFocus.current !== null && lastFocus.current !== focusKey;
    lastFocus.current = focusKey;
    const id = requestAnimationFrame(() => scrollToAyah(list.current, index, animated));
    return () => cancelAnimationFrame(id);
  }, [focusKey, index, padding]);

  return <FlatList
    ref={list}
    style={s.pane}
    data={verses}
    extraData={`${focusKey}:${progressKey}`}
    keyExtractor={(item) => refKey(item)}
    showsVerticalScrollIndicator={false}
    initialNumToRender={8}
    maxToRenderPerBatch={8}
    windowSize={5}
    onScrollToIndexFailed={({ index: failed, averageItemLength }) => {
      list.current?.scrollToOffset({ offset: Math.max(0, averageItemLength * failed), animated: false });
      requestAnimationFrame(() => scrollToAyah(list.current, failed, false));
    }}
    contentContainerStyle={[s.verseList, { paddingVertical: padding }]}
    renderItem={({ item }) => {
      const focused = refKey(item) === focusKey;
      return <View
        style={[s.verseRow, { opacity: focused ? 1 : CONTEXT_OPACITY }]}
        accessibilityLabel={item.translation ? `${item.arabic}. ${item.translation}` : item.arabic}
      >
        {pane === 'arabic' ? <>
          {!!item.basmala && <Text selectable style={s.arabic}>{item.basmala}</Text>}
          <ArabicVerseText arabic={item.arabic} heard={heardFor(item, wordProgress)} />
        </> : <Text
          selectable
          style={[s.translation, urdu && { fontFamily: fonts.arabic, writingDirection: 'rtl' }]}
        >{item.translation}</Text>}
      </View>;
    }}
  />;
}

export function LiturgyPanes({ liturgy, topInset = 0 }: { liturgy: LiturgyDisplay; topInset?: number }) {
  return <View
    style={[s.panes, { paddingTop: topInset }]}
    accessibilityLabel={`${liturgy.label}. ${liturgy.categoryLabel}. ${liturgy.arabic}. ${liturgy.english}`}
  >
    <View style={[s.pane, { justifyContent: 'center' }]}>
      <View style={[s.verseRow, { gap: 6 }]}>
        <Text style={s.liturgyLabel}>{liturgy.label}</Text>
        <Text style={s.liturgyCategory}>{liturgy.categoryLabel}</Text>
        <Text selectable style={s.arabic}>{liturgy.arabic}</Text>
      </View>
    </View>
  </View>;
}

export function HeardWordPanes({ words, topInset = 0 }: { words: string[]; topInset?: number }) {
  return <View style={[s.panes, { paddingTop: topInset }]}>
    <View style={[s.pane, { justifyContent: 'center' }]}>
      <Text selectable style={[s.arabic, { paddingHorizontal: 28 }]}>{words.join(' ')}</Text>
    </View>
  </View>;
}

export function SyncedVersePanes({
  verses, focus, urdu, wordProgress = null, topInset = 0,
}: {
  verses: DisplayVerse[];
  focus: DisplayVerse;
  urdu: boolean;
  wordProgress?: WordProgress | null;
  topInset?: number;
}) {
  const focusKey = refKey(focus);
  const index = passageIndex(verses, focus);
  const [paneHeight, setPaneHeight] = useState(0);
  const padding = passagePanePadding(paneHeight);

  return <View
    style={[s.panes, { paddingTop: topInset }]}
    onLayout={(event) => {
      const height = event.nativeEvent.layout.height;
      setPaneHeight(SHOW_TRANSLATION_PANE ? height / 2 : height);
    }}
  >
    <VersePane pane="arabic" verses={verses} focusKey={focusKey} urdu={urdu} padding={padding} index={index} wordProgress={wordProgress} />
    {SHOW_TRANSLATION_PANE ? (
      <VersePane pane="translation" verses={verses} focusKey={focusKey} urdu={urdu} padding={padding} index={index} wordProgress={null} />
    ) : null}
  </View>;
}
