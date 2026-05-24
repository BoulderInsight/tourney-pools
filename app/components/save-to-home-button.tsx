"use client";

import { useEffect, useState } from "react";

/**
 * Cross-platform 'Save to Home Screen' button. The experience differs by
 * platform because of what each browser actually allows:
 *
 *   Android (Chrome / Edge / Brave): real native install prompt via the
 *     beforeinstallprompt event. We capture it on mount and replay it on
 *     button tap, so a single click gets the user to the standard install
 *     dialog with our app name + icon.
 *
 *   iOS Safari: NO programmatic install API exists. Even Safari's own
 *     bookmark feature isn't scriptable. Best we can do is open a small
 *     instruction sheet pointing at the Share button. The page is otherwise
 *     correctly tagged (apple-touch-icon, apple-mobile-web-app-title) so
 *     when the user follows the steps the icon and label come out right.
 *
 *   Already installed / standalone display mode: hide the button entirely
 *     so it doesn't pester someone who's already on the home-screen version.
 *
 *   Other browsers (desktop, in-app browsers like Instagram / Twitter):
 *     show the iOS-style instructions but generic. Most won't install
 *     anyway; this is the polite fallback.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type Platform = "android-prompt" | "ios-safari" | "other";

function detectPlatform(deferredPrompt: BeforeInstallPromptEvent | null): Platform {
  if (typeof navigator === "undefined") return "other";
  if (deferredPrompt) return "android-prompt";
  const ua = navigator.userAgent;
  // iOS detection covers iPhone, iPad (Safari) and the iPadOS 13+ desktop UA
  // string (Mac-like UA with touch support).
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document);
  return isIOS ? "ios-safari" : "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Both forms exist: iOS uses navigator.standalone, everything else uses the
  // display-mode media query.
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function SaveToHomeButton({ poolName }: { poolName: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const handler = (e: Event) => {
      // beforeinstallprompt fires on Android Chrome / Edge once the engagement
      // heuristic passes. We grab the event and replay it on user click; the
      // browser requires the prompt to happen in a user gesture.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (installed) return null;

  const platform = detectPlatform(deferredPrompt);

  async function handleClick() {
    if (platform === "android-prompt" && deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    // iOS and everything else: show instructions modal.
    setShowInstructions(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-bold text-white bg-tp-accent rounded-xl active:bg-tp-accent-dark transition-colors shadow-card tracking-wide"
        aria-label={`Save ${poolName} to your home screen`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Save to Home Screen
      </button>

      {showInstructions && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          onClick={() => setShowInstructions(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How to save to home screen"
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-xl font-bold text-tp-primary mb-1">
              Save to Home Screen
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Adds <strong>{poolName}</strong> as an icon on your phone for one-tap access.
            </p>

            {platform === "ios-safari" ? (
              <ol className="text-sm text-gray-700 space-y-3 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-tp-primary">1.</span>
                  <span>
                    Tap the{" "}
                    <span className="inline-flex items-center gap-1 align-middle">
                      <svg
                        className="w-4 h-4 inline text-tp-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      <strong>Share</strong>
                    </span>{" "}
                    button at the bottom of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-tp-primary">2.</span>
                  <span>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-tp-primary">3.</span>
                  <span>
                    Tap <strong>Add</strong> in the top right.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="text-sm text-gray-700 space-y-3 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-tp-primary">1.</span>
                  <span>
                    Open your browser&rsquo;s menu (the <strong>⋮</strong> or <strong>⋯</strong> icon).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-tp-primary">2.</span>
                  <span>
                    Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-tp-primary">3.</span>
                  <span>
                    Confirm to add <strong>{poolName}</strong> to your home screen.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="mt-5 w-full py-3 rounded-xl text-sm font-semibold text-gray-600 border border-tp-bg-dark active:bg-tp-bg/60"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
