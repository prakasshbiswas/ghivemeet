'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  encodePassphrase,
  generateRoomId,
  randomString,
} from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

interface CarouselSlide {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function Page() {
  const router = useRouter();

  // Real-time date & time for Google Meet style header
  const [currentDateTime, setCurrentDateTime] = useState('');

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Join input
  const [joinCode, setJoinCode] = useState('');

  // Modals state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [createdRoomLink, setCreatedRoomLink] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings & E2EE State
  const [videoCodec, setVideoCodec] = useState<'vp9' | 'h264' | 'av1' | 'vp8'>('vp9');
  const [hqMode, setHqMode] = useState(true);
  const [e2ee, setE2ee] = useState(false);

  // Carousel index
  const [currentSlide, setCurrentSlide] = useState(0);

  // Update clock every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      setCurrentDateTime(`${timeStr} • ${dateStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carousel data
  const slides: CarouselSlide[] = [
    {
      title: 'Get a link you can share',
      description: 'Click New meeting to get a link you can send to people you want to meet with',
      icon: (
        <svg width="110" height="110" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" fill="#E8F0FE" />
          <path
            d="M52 46H42C37.5817 46 34 49.5817 34 54V66C34 70.4183 37.5817 74 42 74H52"
            stroke="#1A73E8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M68 46H78C82.4183 46 86 49.5817 86 54V66C86 70.4183 82.4183 74 78 74H68"
            stroke="#1A73E8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line x1="48" y1="60" x2="72" y2="60" stroke="#1A73E8" strokeWidth="5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: 'Plan ahead and stay secure',
      description: 'Share a meeting link and enable end-to-end encryption when you need it',
      icon: (
        <svg width="110" height="110" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" fill="#E8F0FE" />
          <path
            d="M60 36L42 44V60C42 71.0457 49.6863 81.2583 60 84C70.3137 81.2583 78 71.0457 78 60V44L60 36Z"
            fill="#1A73E8"
          />
          <path
            d="M54 58L58 62L68 52"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      title: 'Clearer audio when you need it',
      description: 'Noise filtering is available when configured in meeting settings',
      icon: (
        <svg width="110" height="110" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" fill="#E8F0FE" />
          <rect x="52" y="42" width="16" height="26" rx="8" fill="#1A73E8" />
          <path
            d="M44 58C44 66.8366 51.1634 74 60 74C68.8366 74 76 66.8366 76 58"
            stroke="#1A73E8"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line x1="60" y1="74" x2="60" y2="82" stroke="#1A73E8" strokeWidth="4" strokeLinecap="round" />
          <line x1="50" y1="82" x2="70" y2="82" stroke="#1A73E8" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Build target room URL with query params & hash
  const buildRoomUrl = (roomId: string, isE2EE = false, key = '') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    let url = `${origin}/rooms/${encodeURIComponent(roomId)}`;

    const params = new URLSearchParams();
    if (videoCodec !== 'vp9') params.set('codec', videoCodec);
    if (hqMode) params.set('hq', 'true');

    const qs = params.toString();
    if (qs) url += `?${qs}`;
    if (isE2EE && key) url += `#${encodePassphrase(key)}`;

    return url;
  };

  // 1. Create meeting for later
  const handleCreateForLater = () => {
    setShowDropdown(false);
    const newRoom = generateRoomId();
    const key = e2ee ? randomString(32) : '';
    const fullUrl = buildRoomUrl(newRoom, e2ee, key);

    setCreatedRoomLink(fullUrl);
    setShowLinkModal(true);
  };

  // 2. Start an instant meeting
  const handleStartInstantMeeting = () => {
    setShowDropdown(false);
    const newRoom = generateRoomId();

    const query = new URLSearchParams();
    if (videoCodec !== 'vp9') query.set('codec', videoCodec);
    if (hqMode) query.set('hq', 'true');

    const qs = query.toString() ? `?${query.toString()}` : '';
    router.push(`/rooms/${encodeURIComponent(newRoom)}${qs}`);
  };

  // 3. Start an encrypted meeting
  const handleStartEncryptedMeeting = () => {
    setShowDropdown(false);
    const newRoom = generateRoomId();
    const newKey = randomString(32);

    const query = new URLSearchParams();
    if (videoCodec !== 'vp9') query.set('codec', videoCodec);
    if (hqMode) query.set('hq', 'true');

    const qs = query.toString() ? `?${query.toString()}` : '';
    const hash = `#${encodePassphrase(newKey)}`;
    router.push(`/rooms/${encodeURIComponent(newRoom)}${qs}${hash}`);
  };

  // 4. Join meeting by code or URL
  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinCode.trim()) return;

    let target = joinCode.trim();
    let hash = '';

    // Handle pasted full URLs
    if (target.includes('http://') || target.includes('https://') || target.includes('/rooms/')) {
      try {
        const urlObj = new URL(target, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        const match = urlObj.pathname.match(/\/rooms\/([^/?#]+)/);
        if (match && match[1]) {
          target = decodeURIComponent(match[1]);
        }
        if (urlObj.hash) {
          hash = urlObj.hash;
        }
      } catch {
        // Fallback
      }
    }

    target = target.replace(/^\/+|\/+$/g, '');
    router.push(`/rooms/${encodeURIComponent(target)}${hash}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Link copied to clipboard'),
      () => toast.error('Failed to copy')
    );
  };

  return (
    <div className={styles.container}>
      {/* Top Header Navbar */}
      <header className={styles.navHeader}>
        <Link href="/" className={styles.brandGroup}>
          <Image
            src="/images/gdelivers-logo.png"
            alt="G Delivers"
            width={40}
            height={40}
            className={styles.brandLogoImg}
            priority
          />
          <span className={styles.brandTitle}>
            G-Hive <span className={styles.brandTitleHighlight}>Meet</span>
          </span>
        </Link>

        <div className={styles.headerRight}>
          {currentDateTime && <span className={styles.dateTimeText}>{currentDateTime}</span>}


          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className={styles.iconButton}
            title="Meeting Settings"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className={styles.mainHero}>
        {/* Left Column: Headline and Actions */}
        <div className={styles.heroLeft}>
          <h1 className={styles.headline}>Video calls and meetings for everyone</h1>
          <p className={styles.subheadline}>
            Connect, collaborate, and celebrate from anywhere with G-Hive Meet. High-performance, secure WebRTC video calls powered by GHivePH and GMakesIT.
          </p>

          {/* Action Row */}
          <div className={styles.actionRow}>
            {/* New Meeting Button & Dropdown */}
            <div className={styles.newMeetingBtnWrap} ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className={styles.newMeetingBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
                <span>New meeting</span>
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className={styles.dropdownMenu}>
                  <button type="button" onClick={handleCreateForLater} className={styles.dropdownItem}>
                    <span className={styles.dropdownItemIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </span>
                    <span>Create a meeting for later</span>
                  </button>

                  <button type="button" onClick={handleStartInstantMeeting} className={styles.dropdownItem}>
                    <span className={styles.dropdownItemIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </span>
                    <span>Start an instant meeting</span>
                  </button>

                  <button type="button" onClick={handleStartEncryptedMeeting} className={styles.dropdownItem}>
                    <span className={styles.dropdownItemIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <span>Start encrypted meeting (E2EE)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Join Code Input & Button */}
            <form onSubmit={handleJoin} className={styles.joinForm}>
              <div className={styles.inputContainer}>
                <span className={styles.keyboardIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <line x1="6" y1="8" x2="6.01" y2="8" />
                    <line x1="10" y1="8" x2="10.01" y2="8" />
                    <line x1="14" y1="8" x2="14.01" y2="8" />
                    <line x1="18" y1="8" x2="18.01" y2="8" />
                    <line x1="6" y1="12" x2="6.01" y2="12" />
                    <line x1="18" y1="12" x2="18.01" y2="12" />
                    <line x1="7" y1="16" x2="17" y2="16" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Enter a code or link"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className={styles.joinInput}
                />
              </div>

              <button
                type="submit"
                disabled={!joinCode.trim()}
                className={styles.joinBtn}
              >
                Join
              </button>
            </form>
          </div>

          <div className={styles.divider} />

          {/* Sublinks */}
          <div className={styles.learnMoreRow}>
            <div className={styles.encryptionBadge}>
              <span>Powered by LiveKit WebRTC</span>
            </div>

            <div className={styles.encryptionBadge}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Optional end-to-end encryption</span>
            </div>
          </div>
        </div>

        {/* Right Column: Google Meet Style Carousel */}
        <div className={styles.heroRight}>
          <div className={styles.carouselContainer}>
            <div className={styles.carouselImageWrap}>
              {slides[currentSlide].icon}
            </div>

            <h2 className={styles.carouselTitle}>{slides[currentSlide].title}</h2>
            <p className={styles.carouselDescription}>{slides[currentSlide].description}</p>

            <div className={styles.carouselControls}>
              <button
                type="button"
                onClick={handlePrevSlide}
                className={styles.carouselArrowBtn}
                title="Previous"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div className={styles.dotsWrapper}>
                {slides.map((_, index) => (
                  <span
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`${styles.dot} ${index === currentSlide ? styles.activeDot : ''}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextSlide}
                className={styles.carouselArrowBtn}
                title="Next"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div>
          <span>Powered by GHivePH and GMakesIT.</span>
        </div>
        <div className={styles.footerLinks}>
          <span className={styles.footerLink}>Optional end-to-end encryption</span>
          <span>•</span>
          <span className={styles.footerLink}>Optional noise filtering</span>
        </div>
      </footer>

      {/* "Here's the link to your meeting" Modal */}
      {showLinkModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowLinkModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Here&apos;s the link to your meeting</h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className={styles.closeModalBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ margin: 0 }}>
                Copy this link and send it to people you want to meet with. Be sure to save it so you can use it later, too.
              </p>

              <div className={styles.copyLinkBox}>
                <span className={styles.linkText}>{createdRoomLink}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdRoomLink)}
                  className={styles.copyIconBtn}
                  title="Copy link"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className={styles.joinBtn}
                style={{ color: '#5f6368' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = new URL(createdRoomLink);
                  router.push(`${url.pathname}${url.search}${url.hash}`);
                }}
                className={styles.newMeetingBtn}
              >
                Join now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowSettingsModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Meeting Settings</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className={styles.closeModalBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.settingsSection}>
                <label className={styles.settingsSectionTitle}>Video Codec</label>
                <select
                  value={videoCodec}
                  onChange={(e) => setVideoCodec(e.target.value as any)}
                  className={styles.settingsSelect}
                >
                  <option value="vp9">VP9 (Recommended · High Quality)</option>
                  <option value="h264">H.264 (Hardware Accelerated)</option>
                  <option value="av1">AV1 (Next-Gen Compression)</option>
                  <option value="vp8">VP8 (Broad Compatibility)</option>
                </select>
              </div>

              <div className={styles.settingsSection}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={hqMode}
                    onChange={(e) => setHqMode(e.target.checked)}
                    className={styles.checkboxInput}
                  />
                  <span>High quality video</span>
                </label>
              </div>

              <div className={styles.settingsSection}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={e2ee}
                    onChange={(e) => setE2ee(e.target.checked)}
                    className={styles.checkboxInput}
                  />
                  <span>Enable End-to-End Encryption by default</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  toast.success('Settings saved');
                }}
                className={styles.newMeetingBtn}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
