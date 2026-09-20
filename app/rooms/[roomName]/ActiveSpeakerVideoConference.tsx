'use client';

import * as React from 'react';
import type {
  MessageDecoder,
  MessageEncoder,
  TrackReferenceOrPlaceholder,
  WidgetState,
} from '@livekit/components-core';
import { isEqualTrackRef, isTrackReference, isWeb, log } from '@livekit/components-core';
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
  useRoomContext,
  Chat,
  ControlBar,
  type MessageFormatter,
} from '@livekit/components-react';
import { RoomEvent, Track, type Participant } from 'livekit-client';

export interface ActiveSpeakerVideoConferenceProps extends React.HTMLAttributes<HTMLDivElement> {
  chatMessageFormatter?: MessageFormatter;
  chatMessageEncoder?: MessageEncoder;
  chatMessageDecoder?: MessageDecoder;
  SettingsComponent?: React.ComponentType;
}

/**
 * Sorts track references so that:
 * 1. Screen share tracks come first.
 * 2. Currently active speaker (highest audio / isSpeaking) is placed at POSITION #1 (index 0).
 * 3. Recently active speakers (lastSpokeAt) come next.
 * 4. Participants with camera enabled come next.
 * 5. Remote participants come before local self-view so active speakers aren't blocked by self-view.
 */
function sortTracksByActiveSpeaker(
  tracks: TrackReferenceOrPlaceholder[],
  activeSpeakers: Participant[] = [],
): TrackReferenceOrPlaceholder[] {
  return [...tracks].sort((a, b) => {
    // 1. Screen share takes highest priority
    const aIsScreenShare = a.source === Track.Source.ScreenShare;
    const bIsScreenShare = b.source === Track.Source.ScreenShare;
    if (aIsScreenShare && !bIsScreenShare) return -1;
    if (!aIsScreenShare && bIsScreenShare) return 1;

    // 2. Active speaker priority
    const aSpeakerIdx = activeSpeakers.findIndex(
      (s) => s.identity === a.participant.identity,
    );
    const bSpeakerIdx = activeSpeakers.findIndex(
      (s) => s.identity === b.participant.identity,
    );

    const aIsActive = aSpeakerIdx !== -1 || a.participant.isSpeaking;
    const bIsActive = bSpeakerIdx !== -1 || b.participant.isSpeaking;

    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    // If both are speaking, order by activeSpeakers list or audio level
    if (aIsActive && bIsActive) {
      if (aSpeakerIdx !== -1 && bSpeakerIdx !== -1 && aSpeakerIdx !== bSpeakerIdx) {
        return aSpeakerIdx - bSpeakerIdx;
      }
      return (b.participant.audioLevel || 0) - (a.participant.audioLevel || 0);
    }

    // 3. Recently active speakers (lastSpokeAt)
    const aLastSpoke = a.participant.lastSpokeAt
      ? new Date(a.participant.lastSpokeAt).getTime()
      : 0;
    const bLastSpoke = b.participant.lastSpokeAt
      ? new Date(b.participant.lastSpokeAt).getTime()
      : 0;
    if (aLastSpoke !== bLastSpoke) {
      return bLastSpoke - aLastSpoke;
    }

    // 4. Camera enabled comes before camera disabled
    const aCamera = a.participant.isCameraEnabled;
    const bCamera = b.participant.isCameraEnabled;
    if (aCamera && !bCamera) return -1;
    if (!aCamera && bCamera) return 1;

    // 5. Remote participants preferred over local participant for front slots
    if (!a.participant.isLocal && b.participant.isLocal) return -1;
    if (a.participant.isLocal && !b.participant.isLocal) return 1;

    // 6. Join order
    const aJoined = a.participant.joinedAt ? new Date(a.participant.joinedAt).getTime() : 0;
    const bJoined = b.participant.joinedAt ? new Date(b.participant.joinedAt).getTime() : 0;
    return aJoined - bJoined;
  });
}

export function ActiveSpeakerVideoConference({
  chatMessageFormatter,
  chatMessageDecoder,
  chatMessageEncoder,
  SettingsComponent,
  ...props
}: ActiveSpeakerVideoConferenceProps) {
  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });

  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);
  const room = useRoomContext();
  const [activeSpeakers, setActiveSpeakers] = React.useState<Participant[]>([]);

  // Listen to active speakers in real time
  React.useEffect(() => {
    if (!room) return;
    const onActiveSpeakersChanged = (speakers: Participant[]) => {
      setActiveSpeakers([...speakers]);
    };
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
    };
  }, [room]);

  const rawTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  // Sort tracks so active speaker is always FIRST
  const tracks = React.useMemo(() => {
    return sortTracksByActiveSpeaker(rawTracks, activeSpeakers);
  }, [rawTracks, activeSpeakers]);

  const widgetUpdate = (state: WidgetState) => {
    log.debug('updating widget state', state);
    setWidgetState(state);
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  React.useEffect(() => {
    // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      log.debug('Auto set screen share focus:', { newScreenShareTrack: screenShareTracks[0] });
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      log.debug('Auto clearing screen share focus.');
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
      }
    }
  }, [
    screenShareTracks
      .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    tracks,
  ]);

  return (
    <div className="lk-video-conference" {...props}>
      {isWeb() && (
        <LayoutContextProvider
          value={layoutContext}
          onWidgetChange={widgetUpdate}
        >
          <div className="lk-video-conference-inner">
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                  {focusTrack && <FocusLayout trackRef={focusTrack} />}
                </FocusLayoutContainer>
              </div>
            )}
            <ControlBar controls={{ chat: true, settings: !!SettingsComponent }} />
          </div>
          <Chat
            style={{ display: widgetState.showChat ? 'grid' : 'none' }}
            messageFormatter={chatMessageFormatter}
            messageEncoder={chatMessageEncoder}
            messageDecoder={chatMessageDecoder}
          />
          {SettingsComponent && (
            <div
              className="lk-settings-menu-modal"
              style={{ display: widgetState.showSettings ? 'block' : 'none' }}
            >
              <SettingsComponent />
            </div>
          )}
        </LayoutContextProvider>
      )}
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}
