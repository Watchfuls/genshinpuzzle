import { createContext, useContext, useEffect, useMemo, useState } from "react";

type CharacterOrder = "name" | "release";

type SettingsCookie = {
  autoRevealHints: boolean;
  characterOrder: CharacterOrder;
  hideKofi: boolean;
};

type Settings = SettingsCookie & {
  setAutoRevealHints: (v: boolean) => void;
  setCharacterOrder: (v: CharacterOrder) => void;
  setHideKofi: (v: boolean) => void;
};

const SettingsContext = createContext<Settings | null>(null);

const COOKIE = "gdg_settings_v1";

function readCookie(): Partial<SettingsCookie> {
  const match = document.cookie.split("; ").find((r) => r.startsWith(`${COOKIE}=`));
  if (!match) return {};

  try {
    const raw = decodeURIComponent(match.split("=")[1] ?? "");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<SettingsCookie>) : {};
  } catch {
    return {};
  }
}

function writeCookie(data: SettingsCookie) {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(data))}; Max-Age=${
    60 * 60 * 24 * 365
  }; Path=/; SameSite=Lax`;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const saved = useMemo(() => readCookie(), []);

  const [autoRevealHints, setAutoRevealHints] = useState<boolean>(saved.autoRevealHints ?? false);

  const [characterOrder, setCharacterOrder] = useState<CharacterOrder>(
    saved.characterOrder ?? "name",
  );

  const [hideKofi, setHideKofi] = useState<boolean>(saved.hideKofi ?? false);

  useEffect(() => {
    writeCookie({ autoRevealHints, characterOrder, hideKofi });
  }, [autoRevealHints, characterOrder, hideKofi]);

  return (
    <SettingsContext.Provider
      value={{
        autoRevealHints,
        characterOrder,
        hideKofi,
        setAutoRevealHints,
        setCharacterOrder,
        setHideKofi,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}