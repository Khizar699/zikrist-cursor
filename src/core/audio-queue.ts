export interface AudioPacket {
  samples: Float32Array;
  endMs: number;
  voicedMs?: number;
  voiced?: boolean;
  queuedAtMs?: number;
  queueWaitMs?: number;
  stallMs?: number;
}

/** One in-flight inference and bounded pending audio. Reset only between runs. */
export class AudioQueue<T> {
  private packets: AudioPacket[] = [];
  private samples = 0;
  private generation = 0;
  private needsReset = false;
  private closed = false;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: {
    maxSamples: number; maxBatchSamples?: number; process: (packet: AudioPacket) => Promise<T>;
    result: (result: T, packet: AudioPacket) => void; reset: () => void;
    gap: (reason: string) => void; error: (error: unknown) => void;
    drop?: (droppedSamples: number) => void;
  }) {}

  push(packet: AudioPacket): void {
    if (this.closed) return;
    const incoming = packet.queuedAtMs == null ? { ...packet, queuedAtMs: Date.now() } : packet;
    if (incoming.samples.length > this.options.maxSamples) { this.discontinuity('oversized packet'); return; }
    if (this.samples + incoming.samples.length > this.options.maxSamples) this.dropOldest(incoming.samples.length);
    if (this.samples + incoming.samples.length > this.options.maxSamples) return;
    this.packets.push(incoming);
    this.samples += incoming.samples.length;
    if (!this.running && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.running = this.drain().finally(() => { this.running = null; });
      }, 0);
    }
  }

  discontinuity(reason = 'capture discontinuity'): void {
    if (this.closed) return;
    this.generation++;
    this.packets = [];
    this.samples = 0;
    this.needsReset = true;
    this.options.gap(reason);
  }

  /** Keep the in-flight hop and the lock. Newest voiced audio wins. */
  private dropOldest(needed: number): void {
    let dropped = 0;
    while (this.packets.length && this.samples + needed > this.options.maxSamples) {
      const packet = this.packets.shift()!;
      this.samples -= packet.samples.length;
      dropped += packet.samples.length;
    }
    if (dropped) this.options.drop?.(dropped);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.generation++;
    this.packets = [];
    this.samples = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.running;
  }

  private async drain(): Promise<void> {
    try {
      while (!this.closed && this.packets.length) {
        if (this.needsReset) { this.options.reset(); this.needsReset = false; }
        const pickedAt = Date.now();
        let packet = this.packets.shift()!;
        const batch = [packet];
        let count = packet.samples.length;
        // Drain a temporary backlog in larger feeds. Preserve activity boundaries:
        // merging silence into speech would change the tracker's VAD decisions.
        while (this.packets.length && this.options.maxBatchSamples) {
          const next = this.packets[0]!;
          if (next.voiced !== packet.voiced || count + next.samples.length > this.options.maxBatchSamples) break;
          batch.push(this.packets.shift()!);
          count += next.samples.length;
        }
        if (batch.length > 1) {
          const samples = new Float32Array(count);
          let offset = 0;
          for (const item of batch) { samples.set(item.samples, offset); offset += item.samples.length; }
          packet = { ...batch[batch.length - 1]!, samples };
        }
        const startAt = Date.now();
        packet = {
          ...packet,
          queueWaitMs: startAt - (batch[0]!.queuedAtMs ?? startAt),
          stallMs: startAt - pickedAt,
        };
        this.samples -= count;
        const generation = this.generation;
        const result = await this.options.process(packet);
        if (!this.closed && generation === this.generation) this.options.result(result, packet);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      this.closed = true;
      this.packets = [];
      this.samples = 0;
      this.options.error(error);
    }
  }
}
