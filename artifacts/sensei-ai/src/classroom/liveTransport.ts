import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteParticipant, RemoteTrack, TranscriptionSegment, Participant } from 'livekit-client';
import type { ClassroomTransport, ClientAction, TeacherEvent } from './types';

/**
 * Real classroom: LiveKit room with the Yuki-sensei agent (and optionally an
 * avatar participant publishing video). The browser only ever holds a
 * short-lived participant token issued by our API.
 */
export class LiveTransport implements ClassroomTransport {
  readonly kind = 'live' as const;
  private room: Room;
  private audioEls: HTMLMediaElement[] = [];

  constructor(
    private url: string,
    private token: string,
    private emit: (event: TeacherEvent) => void,
  ) {
    this.room = new Room({ adaptiveStream: true, dynacast: true });
    this.wire();
  }

  private wire() {
    const room = this.room;
    room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
      if (participant && participant.identity === room.localParticipant.identity) return;
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as TeacherEvent;
        if (message && typeof message === 'object' && 'type' in message) this.emit(message);
      } catch {
        /* ignore non-JSON room data */
      }
    });
    // Streaming transcription from the realtime model -> live subtitles only.
    room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
      if (!participant || participant.identity === room.localParticipant.identity) return;
      const text = segments.map((s) => s.text).join(' ').trim();
      if (text) this.emit({ type: 'live_caption', text, final: segments.every((s) => s.final) });
    });
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.style.display = 'none';
        document.body.appendChild(el);
        this.audioEls.push(el);
      } else if (track.kind === Track.Kind.Video) {
        const el = track.attach() as HTMLVideoElement;
        this.emit({ type: 'avatar_track', element: el });
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      const els = track.detach();
      if (track.kind === Track.Kind.Video) this.emit({ type: 'avatar_track', element: null });
      els.forEach((el) => el.remove());
    });
    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      // Avatar dropped mid-lesson -> fall back to voice + still image.
      if (p.identity.includes('avatar')) {
        this.emit({ type: 'avatar_track', element: null });
        this.emit({ type: 'avatar', status: 'fallback' });
      }
    });
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Reconnecting) this.emit({ type: 'connection', status: 'reconnecting' });
      if (state === ConnectionState.Connected) this.emit({ type: 'connection', status: 'connected' });
      if (state === ConnectionState.Disconnected) this.emit({ type: 'connection', status: 'disconnected' });
    });
  }

  async start() {
    await this.room.connect(this.url, this.token);
    await this.room.startAudio().catch(() => undefined);
    this.emit({ type: 'connection', status: 'connected' });
  }

  async send(action: ClientAction) {
    if (this.room.state !== ConnectionState.Connected) return false;
    try {
      await this.room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(action)), { reliable: true });
      return true;
    } catch {
      return false;
    }
  }

  async setMicrophone(enabled: boolean) {
    try {
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
      return enabled;
    } catch {
      return false;
    }
  }

  async disconnect() {
    await this.room.disconnect();
    this.audioEls.forEach((el) => el.remove());
    this.audioEls = [];
  }
}
