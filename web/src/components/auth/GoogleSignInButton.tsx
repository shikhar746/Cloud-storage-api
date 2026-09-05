import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

const GOOGLE_CLIENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/** Loads the Google Identity Services script once, shared by every caller. */
let gsiPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // let a later mount try again rather than caching the failure forever
      gsiPromise = null;
      reject(new Error('Could not load Google Identity Services'));
    });

    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return gsiPromise;
}

interface GoogleSignInButtonProps {
  /** Receives the Google ID token (JWT) to exchange with our backend. */
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onCredential,
  onError,
  disabled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // the callback goes into Google's SDK once, so read the latest one off a ref
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) {
              void onCredentialRef.current(response.credential);
            } else {
              onError?.('Google did not return a credential. Please try again.');
            }
          },
          ux_mode: 'popup',
          auto_select: false,
        });

        // Google renders its own button in an iframe, so it has to be told a
        // pixel width — match whatever the card gives us.
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: Math.round(containerRef.current.clientWidth) || 320,
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
  }, [onError]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div
        id="google-signin-unconfigured"
        className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-400 flex items-start gap-2"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Google sign-in is unavailable: set <span className="font-mono">VITE_GOOGLE_CLIENT_ID</span>{' '}
          in the web <span className="font-mono">.env</span> (and{' '}
          <span className="font-mono">GOOGLE_CLIENT_ID</span> on the API).
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        id="google-signin-error"
        className="rounded-xl border border-red-800/40 bg-red-950/20 px-3 py-2 text-[11px] text-red-400 flex items-start gap-2"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{loadError}. Check your connection and reload.</span>
      </div>
    );
  }

  return (
    <div
      id="google-signin-button"
      ref={containerRef}
      className={`flex justify-center min-h-[40px] [color-scheme:light] ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
    />
  );
};
