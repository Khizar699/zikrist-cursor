import { useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { CONTEXT_OPACITY, passageIndex } from '../core/passage';
import { refKey, type DisplayVerse } from '../core/types';
import { fonts, styles as s } from './theme';

type Pane = 'arabic' | 'translation';

function scrollToAyah(list: FlatList<DisplayVerse> | null, index: number, animated: boolean): void {
  if (!list || index < 0) return;
  list.scrollToIndex({ index, animated, viewPosition: 0.5 });
}

function VersePane({
  pane, verses, focusKey, urdu, padding, index,
}: {
  pane: Pane;
  verses: DisplayVerse[];
  focusKey: string;
  urdu: boolean;
  padding: number;
  index: number;
}) {
  const list = useRef<FlatList<DisplayVerse>>(null);
  const lastFocus = useRef<string | null>(null);

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
    extraData={focusKey}
    keyExtractor={(item) => refKey(item)}
    showsVerticalScrollIndicator={false}
    initialNumToRender={3}
    maxToRenderPerBatch={3}
    windowSize={3}
    onScrollToIndexFailed={({ index: failed, averageItemLength }) => {
      list.current?.scrollToOffset({ offset: Math.max(0, averageItemLength * failed), animated: false });
      requestAnimationFrame(() => scrollToAyah(list.current, failed, false));
    }}
    contentContainerStyle={[s.verseList, { paddingVertical: padding }]}
    renderItem={({ item }) => {
      const focused = refKey(item) === focusKey;
      return <View style={[s.verseRow, { opacity: focused ? 1 : CONTEXT_OPACITY }]}>
        {pane === 'arabic' ? <>
          {!!item.basmala && <Text selectable style={s.arabic}>{item.basmala}</Text>}
          <Text selectable style={s.arabic}>{item.arabic}</Text>
        </> : <Text
          selectable
          style={[s.translation, urdu && { fontFamily: fonts.arabic, writingDirection: 'rtl' }]}
        >{item.translation}</Text>}
      </View>;
    }}
  />;
}

export function HeardWordPanes({ words }: { words: string[] }) {
  return <View style={s.panes}>
    <View style={[s.pane, { justifyContent: 'center' }]}>
      <Text selectable style={[s.arabic, { paddingHorizontal: 28 }]}>{words.join(' ')}</Text>
    </View>
    <View style={s.pane} />
  </View>;
}

export function SyncedVersePanes({ verses, focus, urdu }: { verses: DisplayVerse[]; focus: DisplayVerse; urdu: boolean }) {
  const focusKey = refKey(focus);
  const index = passageIndex(verses, focus);
  const [paneHeight, setPaneHeight] = useState(0);
  const padding = Math.max(24, paneHeight * 0.38);

  return <View style={s.panes} onLayout={(event) => { setPaneHeight(event.nativeEvent.layout.height / 2); }}>
    <VersePane pane="arabic" verses={verses} focusKey={focusKey} urdu={urdu} padding={padding} index={index} />
    <VersePane pane="translation" verses={verses} focusKey={focusKey} urdu={urdu} padding={padding} index={index} />
  </View>;
}
