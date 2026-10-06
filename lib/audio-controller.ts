export type AudioChapter = { src: string; duration: number };
export type PlaybackSnapshot = { index: number; time: number; playing: boolean; loading: boolean };
type Callbacks = {
  onUpdate: (snapshot: PlaybackSnapshot) => void;
  onError: (message: string) => void;
  onEnded: (index: number) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (frame: number) => void;
};

/** One owner for source changes, queued seeks, and verified media progress. */
export class AudioController {
  private index = -1;
  private time = 0;
  private pendingSeek: number | null = null;
  private desiredPlaying = false;
  private generation = 0;
  private frame: number | null = null;
  private destroyed = false;
  private playRequested = false;
  private readonly listeners: [string, EventListener][] = [];
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (frame: number) => void;

  constructor(
    private readonly media: HTMLAudioElement,
    private readonly chapters: readonly AudioChapter[],
    private readonly positions: Record<string, number>,
    private readonly baseURL: string,
    private readonly callbacks: Callbacks,
  ) {
    this.requestFrame = callbacks.requestFrame ?? requestAnimationFrame;
    this.cancelFrame = callbacks.cancelFrame ?? cancelAnimationFrame;
    this.listen('loadedmetadata', () => this.applyPendingSeek());
    this.listen('canplay', () => this.applyPendingSeek());
    this.listen('canplaythrough', () => this.applyPendingSeek());
    this.listen('progress', () => this.applyPendingSeek());
    this.listen('seeked', () => {
      if (!this.matchesSource()) return;
      if (this.pendingSeek !== null && Math.abs(this.media.currentTime - this.pendingSeek) > 0.25) return;
      this.pendingSeek = null;
      this.readProgress();
      this.startIfRequested();
    });
    this.listen('timeupdate', () => this.readProgress());
    this.listen('play', () => {
      if (!this.matchesSource()) return;
      this.desiredPlaying = true;
      this.emit();
      this.startFrames();
    });
    this.listen('playing', () => {
      if (!this.matchesSource()) return;
      this.emit();
      this.startFrames();
    });
    this.listen('pause', () => {
      this.stopFrames();
      if (this.matchesSource() && this.pendingSeek === null) this.desiredPlaying = false;
      // Source replacement pauses the old recording. It must not cancel autoplay.
      this.emit();
    });
    this.listen('ended', () => {
      if (!this.matchesSource() || this.pendingSeek !== null) return;
      this.readProgress();
      this.desiredPlaying = false;
      this.stopFrames();
      this.emit();
      callbacks.onEnded(this.index);
    });
    this.listen('error', () => {
      if (this.index < 0 || !this.media.error) return;
      this.desiredPlaying = false;
      this.stopFrames();
      this.emit();
      callbacks.onError('This audio could not load. Check your connection and try again.');
    });
  }

  select(index: number, options: { autoplay?: boolean; seconds?: number } = {}) {
    if (!Number.isInteger(index) || !this.chapters[index]) return;
    if (index === this.index) {
      if (options.seconds !== undefined) this.seek(options.seconds);
      if (options.autoplay === true) this.play();
      if (options.autoplay === false) this.pause();
      return;
    }
    const autoplay = options.autoplay ?? this.desiredPlaying;
    this.readProgress();
    this.generation += 1;
    this.playRequested = false;
    this.media.pause();
    this.stopFrames();
    this.index = index;
    this.time = this.clamp(options.seconds ?? this.positions[String(index)] ?? 0);
    this.positions[String(index)] = this.time;
    this.pendingSeek = this.time;
    this.desiredPlaying = autoplay;
    this.media.src = this.sourceURL();
    // Loading is exclusive to source changes; seeking never reloads the MP3.
    this.media.load();
    this.emit();
  }

  seek(seconds: number) {
    if (this.index < 0 || !Number.isFinite(seconds)) return;
    this.time = this.clamp(seconds);
    this.positions[String(this.index)] = this.time;
    this.pendingSeek = this.time;
    this.emit();
    // Before metadata is available, retain the requested point for this source.
    this.applyPendingSeek();
  }

  seekAndPlay(seconds: number) {
    if (this.index < 0 || !Number.isFinite(seconds)) return;
    this.desiredPlaying = true;
    this.seek(seconds);
    // Request playback within the waveform gesture, before async seek events.
    this.requestPlayback();
  }

  play() {
    if (this.index < 0) return;
    this.desiredPlaying = true;
    this.startIfRequested();
    this.emit();
  }

  pause() {
    this.desiredPlaying = false;
    this.media.pause();
    this.stopFrames();
    this.emit();
  }

  toggle() {
    if (this.desiredPlaying || !this.media.paused) this.pause();
    else this.play();
  }

  setRate(rate: number) { this.media.playbackRate = rate; }

  retry() {
    if (this.index < 0) return;
    this.generation += 1;
    this.playRequested = false;
    this.pendingSeek = this.time;
    this.media.load();
    this.emit();
  }

  destroy() {
    this.destroyed = true;
    this.generation += 1;
    this.stopFrames();
    for (const [event, listener] of this.listeners) this.media.removeEventListener(event, listener);
    this.media.pause();
  }

  private sourceURL() { return new URL(this.chapters[this.index].src, this.baseURL).href; }
  private matchesSource() {
    return !this.destroyed && this.index >= 0 && this.media.readyState >= 1 && this.media.currentSrc === this.sourceURL();
  }
  private clamp(seconds: number) {
    const declared = this.chapters[this.index].duration;
    const duration = this.matchesSource() && Number.isFinite(this.media.duration) ? Math.min(declared, this.media.duration) : declared;
    return Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, duration));
  }
  private applyPendingSeek() {
    if (!this.matchesSource()) return;
    if (this.pendingSeek !== null) {
      this.pendingSeek = this.clamp(this.pendingSeek);
      this.time = this.pendingSeek;
      this.positions[String(this.index)] = this.time;
      if (Math.abs(this.media.currentTime - this.pendingSeek) < 0.05 && !this.media.seeking) {
        this.pendingSeek = null;
        this.emit();
        this.startIfRequested();
      } else {
        if (this.media.seeking && Math.abs(this.media.currentTime - this.pendingSeek) < 0.05) return;
        // A later metadata/canplay event can reapply the target, never zero it.
        try { this.media.currentTime = this.pendingSeek; } catch { /* Retry when ready. */ }
      }
    } else this.startIfRequested();
  }
  private readProgress() {
    // Reset events and stale events during source changes cannot overwrite a seek.
    if (!this.matchesSource() || this.pendingSeek !== null || this.media.seeking) return;
    this.time = this.clamp(this.media.currentTime);
    this.positions[String(this.index)] = this.time;
    this.emit();
  }
  private startIfRequested() {
    if (!this.matchesSource() || this.pendingSeek !== null) return;
    this.requestPlayback();
  }
  private requestPlayback() {
    if (!this.desiredPlaying || this.index < 0 || this.media.src !== this.sourceURL() || this.playRequested || !this.media.paused) return;
    const generation = this.generation;
    this.playRequested = true;
    void this.media.play().catch(() => {
      if (generation !== this.generation || this.destroyed || !this.desiredPlaying) return;
      this.desiredPlaying = false;
      this.callbacks.onError('Playback was blocked. Press play to continue.');
      this.emit();
    }).finally(() => {
      if (generation === this.generation) this.playRequested = false;
    });
  }
  private emit() {
    if (this.destroyed || this.index < 0) return;
    this.callbacks.onUpdate({ index: this.index, time: this.time, playing: this.matchesSource() && !this.media.paused, loading: this.pendingSeek !== null });
  }
  private listen(event: string, callback: () => void) {
    const listener: EventListener = callback;
    this.listeners.push([event, listener]);
    this.media.addEventListener(event, listener);
  }
  private startFrames() {
    this.stopFrames();
    const tick = () => {
      this.frame = null;
      if (this.destroyed || this.media.paused) return;
      this.readProgress();
      this.frame = this.requestFrame(tick);
    };
    this.frame = this.requestFrame(tick);
  }
  private stopFrames() {
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
  }
}
