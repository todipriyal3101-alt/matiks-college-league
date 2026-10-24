"use client";

import Script from "next/script";
import { useEffect, useImperativeHandle, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      execution?: "render" | "execute";
      appearance?: "always" | "execute" | "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => boolean | void;
      "timeout-callback"?: () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = {
  /** Runs the check now and resolves with a fresh single-use token, or null if it failed or timed out. */
  getToken: () => Promise<string | null>;
};

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const TIMEOUT_MS = 30_000;

/**
 * Cloudflare Turnstile, invisible (widget mode "Invisible" in the dashboard): nothing is shown and it takes no space.
 * The check runs only when the form asks for a token on submit. Supabase verifies tokens passed as captchaToken
 * (Authentication › Attack Protection › Captcha); sign-up verifies its own (src/app/login/actions.ts).
 */
export function Turnstile({
  action,
  ref,
}: {
  /** Shown in the Cloudflare dashboard analytics, e.g. "signup". */
  action?: string;
  ref?: React.Ref<TurnstileHandle>;
}) {
  const el = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const waiting = useRef<((token: string | null) => void) | null>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);

  const settle = (token: string | null) => {
    waiting.current?.(token);
    waiting.current = null;
  };

  useImperativeHandle(ref, () => ({
    getToken: () =>
      new Promise<string | null>((resolve) => {
        if (!TURNSTILE_SITE_KEY) return resolve(null);
        settle(null); // a previous request still waiting gives up
        const timer = setTimeout(() => settle(null), TIMEOUT_MS);
        waiting.current = (token) => {
          clearTimeout(timer);
          resolve(token);
        };
        // The script may still be loading on a fast submit: start as soon as the widget exists.
        const start = () => {
          if (!waiting.current) return;
          if (!widgetId.current || !window.turnstile) return void setTimeout(start, 100);
          window.turnstile.reset(widgetId.current); // tokens are single-use: always a fresh one
          window.turnstile.execute(widgetId.current);
        };
        start();
      }),
  }));

  useEffect(() => {
    if (!ready || !TURNSTILE_SITE_KEY || !el.current || !window.turnstile) return;
    const id = window.turnstile.render(el.current, {
      sitekey: TURNSTILE_SITE_KEY,
      action,
      execution: "execute",
      appearance: "execute",
      callback: (token) => settle(token),
      // true: handled here (no console error from Turnstile); the form shows the message.
      "error-callback": () => {
        settle(null);
        return true;
      },
      "timeout-callback": () => settle(null),
    });
    widgetId.current = id;
    return () => {
      widgetId.current = null;
      window.turnstile?.remove(id);
    };
  }, [ready, action]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      {/* Off-screen and zero-size (not display:none, which would stop the check from running). */}
      <div ref={el} aria-hidden className="pointer-events-none fixed -left-[9999px] size-0 overflow-hidden" />
    </>
  );
}
