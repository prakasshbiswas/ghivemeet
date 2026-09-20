'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  encodePassphrase,
  generateRoomId,
  randomString,
} from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

export default function Page() {
  const router = useRouter();

  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(
    randomString(64),
  );

  const startMeeting = () => {
    const roomId = generateRoomId();

    if (e2ee) {
      router.push(
        `/rooms/${roomId}#${encodePassphrase(sharedPassphrase)}`,
      );
    } else {
      router.push(`/rooms/${roomId}`);
    }
  };

  return (
    <main
      className={styles.main}
      data-lk-theme="default"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at top, #172554 0%, #0f172a 45%, #020617 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          textAlign: 'center',
        }}
      >
        {/* BRAND */}
        <div
          style={{
            marginBottom: '36px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '70px',
              height: '70px',
              borderRadius: '20px',
              background:
                'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
              fontSize: '30px',
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: '18px',
              boxShadow:
                '0 12px 40px rgba(37, 99, 235, 0.35)',
            }}
          >
            G
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '42px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-1px',
            }}
          >
            G-Hive Meet
          </h1>

          <p
            style={{
              marginTop: '12px',
              marginBottom: 0,
              color: '#94a3b8',
              fontSize: '18px',
              lineHeight: 1.6,
            }}
          >
            Connect. Collaborate. Communicate.
          </p>
        </div>

        {/* MEETING CARD */}
        <div
          style={{
            padding: '32px',
            borderRadius: '24px',
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: '10px',
              color: '#ffffff',
              fontSize: '24px',
            }}
          >
            Ready to connect?
          </h2>

          <p
            style={{
              color: '#94a3b8',
              marginTop: 0,
              marginBottom: '28px',
              lineHeight: 1.6,
            }}
          >
            Start a secure video meeting and invite your team,
            friends or colleagues.
          </p>

          <button
            className="lk-button"
            onClick={startMeeting}
            style={{
              width: '100%',
              padding: '15px 24px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              background:
                'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
              color: '#ffffff',
            }}
          >
            Start New Meeting
          </button>

          {/* E2EE */}
          <div
            style={{
              marginTop: '22px',
              paddingTop: '22px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              textAlign: 'left',
            }}
          >
            <label
              htmlFor="use-e2ee"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                color: '#cbd5e1',
                fontSize: '14px',
              }}
            >
              <input
                id="use-e2ee"
                type="checkbox"
                checked={e2ee}
                onChange={(event) =>
                  setE2ee(event.target.checked)
                }
              />

              Enable end-to-end encryption
            </label>

            {e2ee && (
              <div
                style={{
                  marginTop: '16px',
                }}
              >
                <label
                  htmlFor="passphrase"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                  }}
                >
                  Meeting Passphrase
                </label>

                <input
                  id="passphrase"
                  type="password"
                  value={sharedPassphrase}
                  onChange={(event) =>
                    setSharedPassphrase(event.target.value)
                  }
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border:
                      '1px solid rgba(255,255,255,0.12)',
                    background: '#0f172a',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <p
          style={{
            marginTop: '28px',
            marginBottom: 0,
            color: '#64748b',
            fontSize: '13px',
          }}
        >
          Secure video conferencing powered by G-Hive
        </p>

        <p
          style={{
            marginTop: '6px',
            color: '#475569',
            fontSize: '12px',
          }}
        >
          © 2026 G-Hive. All rights reserved.
        </p>
      </div>
    </main>
  );
}
