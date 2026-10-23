"use client";

import Script from "next/script";
import { useEffect, useImperativeHandle, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      action?: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = {
  /** Tokens are single-use: call after every auth request so the next one gets a fresh token. */
  reset: () => void;
};

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile widget. Calls onToken with a token, or "" when it expires, fails or is reset.
 * Supabase verifies the token (Authentication › Attack Protection › Captcha) when it's passed as captchaToken.
 */
export function Turnstile({
  onToken,
  action,
  ref,
}: {
  onToken: (token: string) => void;
  /** Shown in the Cloudflare dashboard analytics, e.g. "signup". */
  action?: string;
  ref?: React.Ref<TurnstileHandle>;
}) {
  const el = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current("");
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!ready || !TURNSTILE_SITE_KEY || !el.current || !window.turnstile) return;
    const id = window.turnstile.render(el.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      action,
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(""),
      "error-callback": () => onTokenRef.current(""),
    });
    widgetId.current = id;
    return () => {
      widgetId.current = null;
      window.turnstile?.remove(id);
    };
  }, [ready, action]);

  if (!TURNSTILE_SITE_KEY) {
    return <p className="text-sm text-destructive">Captcha is not configured (NEXT_PUBLIC_TURNSTILE_SITE_KEY).</p>;
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      {/* Reserve the widget's height so the buttons below don't jump when it appears. */}
      <div ref={el} role="group" aria-label="Security check" className="min-h-[65px]" />
    </>
  );
}
