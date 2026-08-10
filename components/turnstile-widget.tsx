"use client";

import Script from "next/script";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

type TurnstileOptions = {
  sitekey: string;
  action?: string;
  appearance?: "always" | "execute" | "interaction-only";
  size?: "normal" | "compact" | "flexible";
  theme?: "light" | "dark" | "auto";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: (errorCode?: string) => boolean | void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type TurnstileWidgetProps = {
  siteKey: string;
  className?: string;
  onError?: (errorCode?: string) => void;
  onVerify: (token: string) => void;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ siteKey, className, onError, onVerify }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onErrorRef = useRef(onError);
    const onVerifyRef = useRef(onVerify);

    useEffect(() => {
      onErrorRef.current = onError;
      onVerifyRef.current = onVerify;
    }, [onError, onVerify]);

    const renderWidget = useCallback(() => {
      const api = window.turnstile;
      const container = containerRef.current;

      if (!api || !container || widgetIdRef.current) return;

      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        action: "authenticate",
        appearance: "always",
        size: "flexible",
        theme: "light",
        callback: (token) => onVerifyRef.current(token),
        "expired-callback": () => onVerifyRef.current(""),
        "error-callback": (errorCode) => {
          onVerifyRef.current("");
          onErrorRef.current?.(errorCode);
          return true;
        },
      });
    }, [siteKey]);

    useImperativeHandle(ref, () => ({
      reset() {
        onVerifyRef.current("");
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }), []);

    useEffect(() => {
      renderWidget();

      return () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [renderWidget]);

    return (
      <>
        <Script
          id="cloudflare-turnstile"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={renderWidget}
          onError={() => onErrorRef.current?.()}
        />
        <div ref={containerRef} className={className} />
      </>
    );
  },
);
