import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  AudioManager, AudioRecorder, RecordingNotificationManager, type AudioEventSubscription,
} from 'react-native-audio-api';
import type { TilawaSession } from '@tilawa/core';
import { AudioQueue } from '../core/audio-queue';
import { Timeline } from '../core/timeline';
import { ContinuationGate } from '../core/continuation-gate';
import { RecitationFollower } from '../core/follower';
import { shouldReplaceHeldVerse } from '../core/display-hold';
import { samePassage } from '../core/passage';
import { isCaptureGap, isLongPause, isSpeech } from '../core/capture-policy';
import { nextSequentialRef, approachingSurahEnd, shouldRevealSequentialNext } from '../core/sequential';
import type { DisplayVerse, RecognitionMessage, VerseRef, WordProgress } from '../core/types';
import { content } from './content';
import { loadModel } from './model';
import liturgyPack from '../../assets/content/salah-liturgy.json';
import { reduceListeningDisplay, type LiturgyDisplay } from '../core/salah-liturgy-display';
import {
  filterQuranMessagesForLiturgy,
  liturgyFollowContextBeforeFeed,
  matcherFromPack,
  packFromUnknown,
  type SalahLiturgyLockEvent,
} from '../core/salah-liturgy-matcher';

type InferenceBatch = { quran: RecognitionMessage[]; liturgy: SalahLiturgyLockEvent | null };
const pack = packFromUnknown(liturgyPack);

export type ListeningState = {
  status: 'loading' | 'ready' | 'starting' | 'listening' | 'stopping' | 'error';
  phase: 'searching' | 'following' | 'waiting';
  error: string | null;
  current: DisplayVerse | null;
  passage: DisplayVerse[];
  draftWords: string[];
  liturgy: LiturgyDisplay | null;
  wordProgress: WordProgress | null;
  meter: number[];
};
const initial: ListeningState = {
  status: 'loading', phase: 'searching', error: null, current: null, passage: [], draftWords: [], liturgy: null, wordProgress: null, meter: [],
};
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

class Listening {
  private state: ListeningState = initial;
  private listeners = new Set<() => void>();
  private session: TilawaSession | null = null;
  private recorder: AudioRecorder | null = null;
  private queue: AudioQueue<InferenceBatch> | null = null;
  private timeline = new Timeline();
  private subscriptions: AudioEventSubscription[] = [];
  private stopping: Promise<void> | null = null;
  private durationLimit: ReturnType<typeof setTimeout> | null = null;
  private displayGeneration = 0;
  private silentSeconds = 0;
  private silenceReset = false;
  private lastAudioEnd: number | null = null;
  private voicedMs = 0;
  private meter: number[] = [];
  private meterTimer: ReturnType<typeof setTimeout> | null = null;
  private gate: ContinuationGate | null = null;
  private follower: RecitationFollower | null = null;
  private liturgy = matcherFromPack(pack);

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(patch: Partial<ListeningState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private scheduleMeter(): void {
    if (this.meterTimer) return;
    this.meterTimer = setTimeout(() => {
      this.meterTimer = null;
      if (this.state.status === 'listening') this.update({ meter: this.meter });
    }, 80);
  }
  async prepare(): Promise<void> {
    if (this.session) return;
    this.update({ status: 'loading', error: null });
    try {
      this.session = await loadModel();
      this.update({ status: 'ready' });
    } catch (error) { this.update({ status: 'error', error: errorText(error) }); throw error; }
  }
  async start(): Promise<void> {
    if (this.state.status !== 'ready' && this.state.status !== 'error') return;
    if (!content.language) throw new Error('Install your translation language first.');
    this.update({ status: 'starting', error: null });
    try {
      if (!this.session) await this.prepare();
      this.update({ status: 'starting' });
      if (await AudioManager.requestRecordingPermissions() !== 'Granted') throw new Error('Microphone access is off. Enable it for Zikrist in your phone settings, then try again.');
      if (Platform.OS === 'android') await AudioManager.requestNotificationPermissions();
      AudioManager.setAudioSessionOptions({ iosCategory: 'record', iosMode: 'measurement', iosOptions: [] });
      AudioManager.observeAudioInterruptions(true);
      await AudioManager.setAudioSessionActivity(true);
      this.session!.reset();
      this.timeline = new Timeline();
      this.silentSeconds = 0;
      this.silenceReset = false;
      this.lastAudioEnd = null;
      this.voicedMs = 0;
      this.meter = [];
      if (this.meterTimer) clearTimeout(this.meterTimer);
      this.meterTimer = null;
      this.follower = new RecitationFollower(this.session!.db, this.session!);
      this.gate = new ContinuationGate((ref) => this.session!.db.getNextVerse(ref.surah, ref.ayah));
      this.liturgy.reset();
      this.recorder = new AudioRecorder();
      this.queue = new AudioQueue({
        maxSamples: 16000 * 6, maxBatchSamples: 16000,
        process: async (packet) => {
          const prior = liturgyFollowContextBeforeFeed(this.follower!);
          const quran = await this.follower!.feed(packet.samples, {
            queueWaitMs: packet.queueWaitMs ?? 0,
            stallMs: packet.stallMs ?? 0,
          });
          const liturgy = this.liturgy.observe({
            tokens: this.follower!.lastHeardTokens,
            atMs: packet.endMs,
            ...prior,
            voiced: packet.voiced === true,
          });
          return { quran, liturgy };
        },
        result: (result, packet) => {
          const quran = this.applyLiturgy(result.quran, result.liturgy);
          this.receive(this.gate!.accept(quran, packet.voicedMs ?? 0, packet.voiced === true), packet.endMs);
          if (this.gate!.isAmbiguousOpening || (this.follower?.phase === 'reacquiring' && this.state.current)) {
            this.update({ phase: 'searching' });
          } else if (this.follower?.phase === 'following' && this.state.current) {
            this.update({ phase: 'following' });
          }
        },
        reset: () => {
          this.session!.reset();
          this.follower!.reset();
          this.gate!.dropPending();
          this.liturgy.reset();
        },
        gap: (reason) => {
          this.timeline.breakSegment();
          this.update({ phase: reason === 'long pause' ? 'waiting' : 'searching' });
        },
        error: (error) => { void this.fail(error); },
      });
      const callback = this.recorder.onAudioReady({ sampleRate: 16000, bufferLength: 4000, channelCount: 1 }, ({ buffer, numFrames, when }) => {
        if (this.state.status !== 'listening') return;
        if (buffer.sampleRate !== 16000 || buffer.numberOfChannels !== 1) { void this.fail(new Error('This microphone route did not provide 16 kHz mono audio. Try the phone microphone.')); return; }
        const samples = buffer.getChannelData(0).slice(0, numFrames);
        const duration = samples.length / 16000;
        if (isCaptureGap(this.lastAudioEnd, when)) this.queue?.discontinuity();
        this.lastAudioEnd = when + duration;
        let sum = 0;
        for (const value of samples) sum += value * value;
        const rms = Math.sqrt(sum / Math.max(1, samples.length));
        const voiced = isSpeech(rms);
        if (voiced) {
          this.voicedMs += duration * 1000;
          this.silentSeconds = 0;
          this.silenceReset = false;
          if (this.state.phase === 'waiting') this.update({ phase: 'searching' });
        } else {
          this.silentSeconds += duration;
          if (isLongPause(this.silentSeconds) && !this.silenceReset) {
            this.queue?.discontinuity('long pause');
            this.silenceReset = true;
          }
        }
        this.meter = [...this.meter.slice(-23), Math.min(1, rms * 12)];
        this.scheduleMeter();
        if (!voiced) return;
        this.queue?.push({ samples, endMs: (when + duration) * 1000, voicedMs: this.voicedMs, voiced: true });
      });
      if (callback.status === 'error') throw new Error(callback.message);
      this.recorder.onError(({ message }) => { void this.fail(new Error(message)); });
      this.subscriptions.push(AudioManager.addSystemEventListener('interruption', ({ type }) => {
        if (type === 'began') void this.fail(new Error('Listening was interrupted by the phone. Tap Listen when you are ready to resume.'));
      }));
      this.subscriptions.push(AudioManager.addSystemEventListener('routeChange', ({ reason }) => {
        if (reason === 'OldDeviceUnavailable' || reason === 'NoSuitableRouteForCategory') void this.fail(new Error('The microphone connection changed. Check your audio input and start again.'));
      }));
      if (Platform.OS === 'android') {
        this.subscriptions.push(RecordingNotificationManager.addEventListener('recordingNotificationPause', () => { void this.stop(); }));
        await RecordingNotificationManager.show({ title: 'Zikrist is listening', contentText: 'Offline translation · pause to end' });
      }
      const result = await this.recorder.start();
      if (result.status === 'error') throw new Error(result.message);
      this.meter = [];
      this.update({ ...initial, status: 'listening' });
      void activateKeepAwakeAsync('zikrist-listening').catch(() => undefined);
      this.durationLimit = setTimeout(() => { void this.fail(new Error('The one-hour MVP session limit was reached. Your session has ended.')); }, 3600_000);
    } catch (error) {
      await this.stop();
      this.update({ status: 'ready', error: errorText(error) });
    }
  }

  private applyLiturgy(
    messages: RecognitionMessage[],
    liturgy: SalahLiturgyLockEvent | null,
  ): RecognitionMessage[] {
    if (!liturgy) return messages;
    this.follower?.reset();
    this.gate?.reset();
    const next = reduceListeningDisplay({
      liturgy: this.state.liturgy,
      current: this.state.current,
      passage: this.state.passage,
      draftWords: this.state.draftWords,
    }, { type: 'salah_liturgy', pack, phraseId: liturgy.phraseId });
    if (next.liturgy !== this.state.liturgy || next.draftWords !== this.state.draftWords) {
      this.displayGeneration += 1;
      this.update({ liturgy: next.liturgy, draftWords: next.draftWords, wordProgress: null });
    }
    return filterQuranMessagesForLiturgy(messages);
  }

  private receive(messages: RecognitionMessage[], offset: number): void {
    if (this.state.status !== 'listening') return;
    for (const message of messages) {
      if (message.type === 'heard_words') {
        if (this.state.current || this.state.liturgy) continue;
        const same = this.state.draftWords.length === message.words.length
          && this.state.draftWords.every((word, index) => word === message.words[index]);
        if (!same) this.update({ draftWords: message.words });
        continue;
      }
      const occurrence = this.timeline.accept(message, offset);
      if (message.type === 'word_progress') {
        this.onWordProgress(message.surah, message.ayah, message.word_index, message.total_words);
        continue;
      }
      if (occurrence) {
        const generation = ++this.displayGeneration;
        const reveal = (verse: DisplayVerse) => {
          const displayedWasConfirmed = this.timeline.occurrences.some((item) => (
            this.state.current !== null
            && item.surah === this.state.current.surah
            && item.ayah === this.state.current.ayah
          ));
          if (
            this.state.liturgy
            || shouldReplaceHeldVerse(this.state.current, verse, {
              hasVerse: (ref) => content.hasVerse(ref),
              displayedWasConfirmed,
            })
          ) {
            this.show(verse, { phase: 'following' });
          }
          this.prepareAhead(verse);
        };
        const cached = content.peek(occurrence);
        if (cached) reveal(cached);
        else {
          void content.verse(occurrence).then((verse) => {
            if (this.state.status !== 'listening' || generation !== this.displayGeneration) return;
            reveal(verse);
          }).catch((error) => { void this.fail(error); });
        }
      }
    }
  }
  private onWordProgress(surah: number, ayah: number, wordIndex: number, totalWords: number): void {
    if (this.state.liturgy) return;
    this.update({ wordProgress: { surah, ayah, wordIndex, totalWords } });
    if (this.gate?.isCheckingJump || this.gate?.isAmbiguousOpening) return;
    if (this.follower?.phase === 'reacquiring') return;
    const displayed = this.state.current;
    if (!displayed || displayed.surah !== surah || displayed.ayah !== ayah) return;
    const hasVerse = (ref: VerseRef) => content.hasVerse(ref);
    const prepared = nextSequentialRef(displayed, hasVerse);
    if (!shouldRevealSequentialNext({ displayed, prepared, wordIndex, totalWords, hasVerse })) return;
    if (!prepared) return;
    const cached = content.peek(prepared);
    if (cached) {
      this.show(cached, { phase: 'following' });
      return;
    }
    const from = { surah: displayed.surah, ayah: displayed.ayah };
    void content.verse(prepared).then((verse) => {
      if (this.state.status !== 'listening' || this.state.liturgy) return;
      if (this.gate?.isCheckingJump || this.gate?.isAmbiguousOpening) return;
      if (this.state.current?.surah !== from.surah || this.state.current.ayah !== from.ayah) return;
      this.show(verse, { phase: 'following' });
    }).catch((error) => { void this.fail(error); });
  }
  private show(verse: DisplayVerse, extra: Partial<ListeningState> = {}): void {
    const passage = content.cachedNeighborhood(verse);
    const sameVerse = this.state.current?.surah === verse.surah && this.state.current.ayah === verse.ayah;
    const same = sameVerse && samePassage(this.state.passage, passage);
    if (same && Object.keys(extra).length === 0 && this.state.draftWords.length === 0 && !this.state.liturgy) return;
    if (this.state.liturgy && sameVerse && Object.keys(extra).length === 0) {
      if (!samePassage(this.state.passage, passage)) this.update({ passage });
      return;
    }
    const next = reduceListeningDisplay({
      liturgy: this.state.liturgy,
      current: this.state.current,
      passage: this.state.passage,
      draftWords: this.state.draftWords,
    }, { type: 'verse_match', verse, passage });
    this.update({ current: next.current, passage: next.passage, draftWords: [], liturgy: null, ...extra });
  }
  private prepareAhead(verse: DisplayVerse): void {
    const next = nextSequentialRef(verse, (ref) => content.hasVerse(ref));
    if (next) void content.verse(next).then(() => {
      if (this.state.status !== 'listening' || !this.state.current) return;
      this.show(this.state.current);
    }).catch((error) => this.update({ error: `Next verses could not be prepared: ${errorText(error)}` }));
    void content.preloadNeighborhood(verse).then(() => {
      if (approachingSurahEnd(verse, (ref) => content.hasVerse(ref))) {
        return content.preloadHandoffOpenings(verse);
      }
    }).then(() => {
      if (this.state.status !== 'listening' || !this.state.current) return;
      this.show(this.state.current);
    }).catch((error) => this.update({ error: `Next verses could not be prepared: ${errorText(error)}` }));
  }
  private async fail(error: unknown): Promise<void> {
    this.update({ error: errorText(error) });
    await this.stop();
  }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.end().finally(() => { this.stopping = null; });
    return this.stopping;
  }
  private async end(): Promise<void> {
    this.update({ status: 'stopping' });
    this.displayGeneration++;
    if (this.meterTimer) clearTimeout(this.meterTimer);
    this.meterTimer = null;
    if (this.durationLimit) clearTimeout(this.durationLimit);
    this.durationLimit = null;
    const errors: string[] = [];
    try { this.recorder?.clearOnAudioReady(); this.recorder?.clearOnError(); await this.recorder?.stop(); }
    catch (error) { errors.push(errorText(error)); }
    this.recorder = null;
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    try { await this.queue?.close(); } catch (error) { errors.push(errorText(error)); }
    this.queue = null;
    try { if (Platform.OS === 'android') await RecordingNotificationManager.hide(); await AudioManager.setAudioSessionActivity(false); } catch (error) { errors.push(errorText(error)); }
    AudioManager.observeAudioInterruptions(false);
    void deactivateKeepAwake('zikrist-listening');
    this.session?.reset();
    this.follower?.reset();
    this.liturgy.reset();
    this.update({
      status: 'ready', meter: [], draftWords: [],
      error: errors.length ? [this.state.error, ...errors].filter(Boolean).join('\n') : this.state.error,
    });
  }
}
export const listening = new Listening();
