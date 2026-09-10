"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { IconoirProvider } from "iconoir-react";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <IconoirProvider iconProps={{ strokeWidth: 2 }}>
        {children}
      </IconoirProvider>
    </NextThemesProvider>
  );
}
