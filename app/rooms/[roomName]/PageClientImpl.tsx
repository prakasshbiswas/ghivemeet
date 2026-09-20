'use client';

import React from 'react';
import toast from 'react-hot-toast';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  ParticipantTile,
  useTracks,
  useSpeakingParticipants,
  RoomAudioRenderer,
  Chat,
  ControlBar,
  LayoutContextProvider,
  useCreateLayoutContext,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder, WidgetState } from '@livekit/components-core';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
  Track,
  Participant,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import confStyles from '@/styles/Conference.module.css';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

// Robust Clipboard Copy with fallback
async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const success = document.execCommand('copy');
    document.body.removeChild(ta);
    return success;
  } catch {
    return false;
  }
}

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  singlePeerConnection: boolean;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const [copiedPreJoin, setCopiedPreJoin] = React.useState(false);

  const isE2EE = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.location.hash && window.location.hash.length > 1);
  }, []);

  const handleCopyMeetingLink = React.useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedPreJoin(true);
      toast.success('Full meeting link copied to clipboard!');
      setTimeout(() => setCopiedPreJoin(false), 2500);
    } else {
      toast.error('Failed to copy meeting link');
    }
  }, []);

  const [isJoining, setIsJoining] = React.useState(false);

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    try {
      setIsJoining(true);
      setPreJoinChoices(values);
      const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
      url.searchParams.append('roomName', props.roomName);
      url.searchParams.append('participantName', values.username || 'Guest');
      if (props.region) {
        url.searchParams.append('region', props.region);
      }
      const connectionDetailsResp = await fetch(url.toString());
      if (!connectionDetailsResp.ok) {
        const errorText = await connectionDetailsResp.text();
        throw new Error(errorText || `Server error (${connectionDetailsResp.status})`);
      }
      const connectionDetailsData = await connectionDetailsResp.json();
      setConnectionDetails(connectionDetailsData);
    } catch (error: any) {
      console.error('Failed to join room:', error);
      const msg = error?.message || '';
      if (msg.includes('LIVEKIT_URL') || msg.includes('LIVEKIT_API_KEY')) {
        toast.error('LiveKit Server not configured! Please configure LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env.local', {
          duration: 7000,
        });
      } else {
        toast.error(`Could not join: ${msg}`, { duration: 5000 });
      }
    } finally {
      setIsJoining(false);
    }
  }, [props.roomName, props.region]);

  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div className={confStyles.preJoinPage}>
          <div className={confStyles.preJoinWrapper}>
            {/* Pre-Join Room Header with Copy Link Action */}
            <div className={confStyles.preJoinCard}>
              <div className={confStyles.roomInfoGroup}>
                <span className={confStyles.roomTitle}>Meeting Room</span>
                <div className={confStyles.roomNameBadge}>
                  <span>{props.roomName}</span>
                  {isE2EE && <span className={confStyles.e2eePill}>🔒 End-to-End Encrypted</span>}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyMeetingLink}
                className={confStyles.copyLinkBtn}
                title="Copy full meeting link to share with others"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copiedPreJoin ? 'Copied!' : 'Copy Meeting Link'}</span>
              </button>
            </div>

            <PreJoin
              defaults={preJoinDefaults}
              onSubmit={handlePreJoinSubmit}
              onError={handlePreJoinError}
            />

            <div className={confStyles.preJoinFooter}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Powered by GMakesIT</span>
            </div>
          </div>
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          roomName={props.roomName}
          options={{
            codec: props.codec,
            hq: props.hq,
            singlePeerConnection: props.singlePeerConnection,
          }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  roomName: string;
  options: {
    hq: boolean;
    codec: VideoCodec;
    singlePeerConnection: boolean;
  };
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: props.options.singlePeerConnection,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices]);

  const lowPowerMode = useLowCPUOptimizer(room);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        <CustomConferenceRoom roomName={props.roomName} room={room} />
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}

/**
 * Custom Conference Room with:
 * 1. Resilient No-Swipe 2x4 (portrait) and 4x2 (landscape) Grid
 * 2. 500ms Debounced Active Speaker auto-sorting & absolute Pinning Priority
 * 3. In-call "Copy Meeting Link" action
 * 4. Runtime capability detection for mobile screen sharing with clear desktop recommendation
 */
function CustomConferenceRoom({ roomName, room }: { roomName: string; room: Room }) {
  const layoutContext = useCreateLayoutContext();
  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });

  // Track orientation (portrait vs landscape) for 2x4 grid calculation
  const [isPortrait, setIsPortrait] = React.useState(true);
  React.useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        setIsPortrait(window.innerHeight > window.innerWidth);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // View mode: 'grid' (2x4) vs 'spotlight' (speaker in front)
  const [viewMode, setViewMode] = React.useState<'grid' | 'spotlight'>('grid');
  const [pinnedTrack, setPinnedTrack] = React.useState<TrackReferenceOrPlaceholder | null>(null);

  // All camera & screen share tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  // Active speakers list (immediate for glow border)
  const rawActiveSpeakers = useSpeakingParticipants();
  const immediateSpeakerIdentities = React.useMemo(
    () => new Set(rawActiveSpeakers.map((s) => s.identity)),
    [rawActiveSpeakers],
  );

  // 500ms Debounced speakers list (for jitter-free tile reordering)
  const [debouncedSpeakers, setDebouncedSpeakers] = React.useState<Participant[]>([]);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSpeakers(rawActiveSpeakers);
    }, 500);
    return () => clearTimeout(timer);
  }, [rawActiveSpeakers]);

  const debouncedSpeakerIdentities = React.useMemo(
    () => new Set(debouncedSpeakers.map((s) => s.identity)),
    [debouncedSpeakers],
  );

  // Safe sorting with ABSOLUTE PINNING PRIORITY & 500ms debounced active speaker
  const sortedTracks = React.useMemo(() => {
    return [...tracks].sort((a, b) => {
      // 1. Screen share tracks take highest precedence
      const aIsScreen = a.source === Track.Source.ScreenShare;
      const bIsScreen = b.source === Track.Source.ScreenShare;
      if (aIsScreen && !bIsScreen) return -1;
      if (!aIsScreen && bIsScreen) return 1;

      // 2. PINNED PARTICIPANT has absolute priority — never displaced by speakers
      if (pinnedTrack) {
        const aPinned = a.participant.identity === pinnedTrack.participant.identity;
        const bPinned = b.participant.identity === pinnedTrack.participant.identity;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
      }

      // 3. Debounced active speaker (prevents tile jitter during quick words/fluctuations)
      const aSpeaking = debouncedSpeakerIdentities.has(a.participant.identity);
      const bSpeaking = debouncedSpeakerIdentities.has(b.participant.identity);
      if (aSpeaking && !bSpeaking) return -1;
      if (!aSpeaking && bSpeaking) return 1;

      return 0;
    });
  }, [tracks, pinnedTrack, debouncedSpeakerIdentities]);

  // Check if any participant is currently screen sharing
  const activeScreenShare = React.useMemo(() => {
    return tracks.find((t) => t.source === Track.Source.ScreenShare);
  }, [tracks]);

  // Active spotlight track
  const spotlightTrack = React.useMemo(() => {
    if (activeScreenShare) return activeScreenShare;
    if (pinnedTrack) {
      const currentPinnedTrack = tracks.find(
        (t) =>
          t.participant.identity === pinnedTrack.participant.identity && t.source === pinnedTrack.source,
      );
      if (currentPinnedTrack) return currentPinnedTrack;
    }
    return sortedTracks[0] || null;
  }, [activeScreenShare, pinnedTrack, sortedTracks, tracks]);

  // Copy meeting link during call
  const handleInCallCopyLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) {
      toast.success('Full meeting link copied to clipboard!');
    } else {
      toast.error('Failed to copy link');
    }
  };

  // Mobile Screen Sharing: Runtime Capability Detection & Graceful Fallback
  const handleScreenShareAction = async () => {
    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const hasDisplayMedia =
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function';

    // If mobile or getDisplayMedia is not reliably available
    if (isMobileDevice || !hasDisplayMedia) {
      toast(
        'Screen sharing is not supported on mobile web browsers. Please join from a desktop browser (Chrome, Edge, or Firefox) to share your screen.',
        {
          icon: 'ℹ️',
          duration: 6000,
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            fontSize: '13px',
            maxWidth: '380px',
            lineHeight: '1.4',
          },
        },
      );
      return;
    }

    // Desktop browsers with confirmed getDisplayMedia capability
    if (room.localParticipant.isScreenShareEnabled) {
      await room.localParticipant.setScreenShareEnabled(false);
      toast.success('Screen share stopped');
    } else {
      try {
        await room.localParticipant.setScreenShareEnabled(true);
        toast.success('Screen sharing started');
      } catch (err: any) {
        if (err?.name !== 'NotAllowedError') {
          toast.error('Could not start screen sharing: ' + (err?.message || 'Permission denied'));
        }
      }
    }
  };

  // Toggle pin on participant
  const handleTileClick = (track: TrackReferenceOrPlaceholder) => {
    if (pinnedTrack?.participant.identity === track.participant.identity) {
      setPinnedTrack(null);
      toast('Unpinned participant');
    } else {
      setPinnedTrack(track);
      toast.success(`Pinned ${track.participant.name || track.participant.identity}`);
    }
  };

  // Dynamic grid column/row calculation: No swiping, up to 8 fits on screen in 2x4!
  const participantCount = sortedTracks.length;
  const gridDims = React.useMemo(() => {
    if (participantCount <= 1) return { cols: 1, rows: 1 };
    if (participantCount === 2) return isPortrait ? { cols: 1, rows: 2 } : { cols: 2, rows: 1 };
    if (participantCount <= 4) return { cols: 2, rows: 2 };
    if (participantCount <= 6) return isPortrait ? { cols: 2, rows: 3 } : { cols: 3, rows: 2 };
    if (participantCount <= 8) return isPortrait ? { cols: 2, rows: 4 } : { cols: 4, rows: 2 }; // 2x4 portrait, 4x2 landscape
    return { cols: isPortrait ? 2 : 4, rows: Math.ceil(participantCount / (isPortrait ? 2 : 4)) };
  }, [participantCount, isPortrait]);

  const is2x4 = participantCount >= 7 && participantCount <= 8;

  return (
    <LayoutContextProvider value={layoutContext} onWidgetChange={setWidgetState}>
      <div className={confStyles.conferenceStage}>
        {/* In-Call Top Navigation & Actions Bar */}
        <header className={confStyles.topBar}>
          <div className={confStyles.topBarLeft}>
            <div className={confStyles.roomTag}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>{roomName}</span>
            </div>

            <button
              type="button"
              onClick={handleInCallCopyLink}
              className={confStyles.topActionBtn}
              title="Copy meeting link to invite others"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy Link</span>
            </button>

            <span className={confStyles.brandBadge}>Powered by GMakesIT</span>
          </div>

          <div className={confStyles.topBarRight}>
            {/* View Mode Toggle: Auto-Grid (2x4) vs Speaker Spotlight */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'grid' ? 'spotlight' : 'grid')}
              className={confStyles.topActionBtn}
              title="Switch between Grid and Spotlight view"
            >
              {viewMode === 'grid' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>{is2x4 ? (isPortrait ? 'Grid (2×4)' : 'Grid (4×2)') : 'Grid'}</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  <span>Spotlight</span>
                </>
              )}
            </button>

            {/* Screen Share Trigger with capability detection */}
            <button
              type="button"
              onClick={handleScreenShareAction}
              className={confStyles.topActionBtn}
              title="Share Screen"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Share</span>
            </button>
          </div>
        </header>

        {/* Video Display Area */}
        <div className={confStyles.videoArea}>
          {/* Spotlight Mode OR Screen Share Active */}
          {viewMode === 'spotlight' || activeScreenShare ? (
            <div className={confStyles.spotlightLayout}>
              {/* Main Featured View: Active Speaker, Screen Share, or Pinned Participant */}
              {spotlightTrack && (
                <div className={confStyles.spotlightMain}>
                  {pinnedTrack?.participant.identity === spotlightTrack.participant.identity && (
                    <div className={confStyles.pinIconBadge}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                      </svg>
                      <span>Pinned</span>
                    </div>
                  )}
                  <ParticipantTile
                    trackRef={spotlightTrack}
                    onParticipantClick={() => handleTileClick(spotlightTrack)}
                  />
                </div>
              )}

              {/* Other attendees in a compact strip */}
              {sortedTracks.length > 1 && (
                <div className={confStyles.spotlightThumbnails}>
                  {sortedTracks
                    .filter(
                      (t) =>
                        t.participant.identity !== spotlightTrack?.participant.identity ||
                        t.source !== spotlightTrack.source,
                    )
                    .map((t) => {
                      const isSpeaking = immediateSpeakerIdentities.has(t.participant.identity);
                      return (
                        <div
                          key={t.publication?.trackSid || t.participant.identity}
                          className={`${confStyles.thumbnailTile} ${isSpeaking ? confStyles.activeSpeakerTile : ''}`}
                          onClick={() => handleTileClick(t)}
                        >
                          <ParticipantTile trackRef={t} />
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            /* No-Swipe Dynamic Responsive Grid (1 to 8+ participants) */
            <div
              className={`${confStyles.gridContainer} ${is2x4 ? confStyles.grid2x4 : ''} ${
                participantCount > 8 ? confStyles.gridScrollVertical : ''
              }`}
              style={{
                gridTemplateColumns: `repeat(${gridDims.cols}, minmax(0, 1fr))`,
                gridTemplateRows:
                  participantCount > 8
                    ? `repeat(${gridDims.rows}, minmax(130px, 1fr))`
                    : `repeat(${gridDims.rows}, minmax(0, 1fr))`,
              }}
            >
              {sortedTracks.map((t) => {
                const isSpeaking = immediateSpeakerIdentities.has(t.participant.identity);
                const isPinned = pinnedTrack?.participant.identity === t.participant.identity;
                return (
                  <div
                    key={t.publication?.trackSid || `${t.participant.identity}_${t.source}`}
                    className={`${confStyles.tileWrapper} ${isSpeaking ? confStyles.activeSpeakerTile : ''} ${
                      isPinned ? confStyles.pinnedTile : ''
                    }`}
                    onClick={() => handleTileClick(t)}
                    title={isPinned ? 'Click to unpin' : 'Click to pin'}
                  >
                    {isPinned && (
                      <div className={confStyles.pinIconBadge}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                        </svg>
                        <span>Pinned</span>
                      </div>
                    )}
                    <ParticipantTile trackRef={t} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LiveKit Control Bar */}
        <div className={confStyles.controlBarWrapper}>
          <ControlBar
            controls={{
              microphone: true,
              camera: true,
              chat: true,
              screenShare: true,
              settings: SHOW_SETTINGS_MENU,
            }}
          />
        </div>

        {/* Side Chat */}
        <Chat
          style={{ display: widgetState.showChat ? 'grid' : 'none' }}
          messageFormatter={formatChatMessageLinks}
        />

        {/* Settings Modal */}
        {SHOW_SETTINGS_MENU && (
          <div
            className="lk-settings-menu-modal"
            style={{ display: widgetState.showSettings ? 'block' : 'none' }}
          >
            <SettingsMenu />
          </div>
        )}

        <RoomAudioRenderer />
      </div>
    </LayoutContextProvider>
  );
}
