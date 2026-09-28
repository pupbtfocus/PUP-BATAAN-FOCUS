declare module "@marsidev/react-turnstile" {
  import * as React from "react";

  export interface TurnstileProps {
    siteKey: string;
    onSuccess?: (token: string) => void;
    onError?: (error?: unknown) => void;
    onExpire?: () => void;
    options?: {
      action?: string;
      cData?: string;
      execution?: "render" | "execute";
      theme?: "light" | "dark" | "auto";
      language?: string;
      tabIndex?: number;
      responseField?: boolean;
      responseFieldName?: string;
      size?: "normal" | "flexible" | "compact" | "invisible";
      retry?: "auto" | "never";
      retryInterval?: number;
      refreshExpired?: "auto" | "manual" | "never";
      refreshTimeout?: "auto" | "manual" | "never";
    };
    className?: string;
    as?: React.ElementType;
    id?: string;
    ref?: React.Ref<TurnstileInstance>;
  }

  export interface TurnstileInstance {
    execute: () => void;
    reset: () => void;
    render?: () => void;
    remove?: () => void;
    getResponse?: () => string | undefined;
  }

  export const Turnstile: React.ForwardRefExoticComponent<
    TurnstileProps & React.RefAttributes<TurnstileInstance>
  >;
}
