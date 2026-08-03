export type MilosAppsLocale = 'de' | 'en';

let readySignalled = false;

declare global {
  interface Window {
    milosAppEssentials?: {
      ready(): void;
    };
  }
}

export function currentLocale(): MilosAppsLocale {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'de';
}

export function subscribeToLocale(listener: (locale: MilosAppsLocale) => void): () => void {
  const handleLocale = (event: Event) => {
    const locale = (event as CustomEvent<{ locale?: string }>).detail?.locale;
    listener(locale === 'en' ? 'en' : 'de');
  };
  window.addEventListener('milosapps:localechange', handleLocale);
  return () => window.removeEventListener('milosapps:localechange', handleLocale);
}

export function signalReady(): void {
  if (readySignalled) return;
  readySignalled = true;

  if (window.milosAppEssentials?.ready) {
    window.milosAppEssentials.ready();
    return;
  }

  // Standalone template preview only. A registered app delegates this state
  // to its pinned Essentials runtime.
  document.body.removeAttribute('data-milos-essentials-loading');
}
