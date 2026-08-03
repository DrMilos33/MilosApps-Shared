import { useEffect, useState } from 'react';
import { currentLocale, subscribeToLocale, type MilosAppsLocale } from './milosapps-bridge';

export function useMilosAppsLocale(): MilosAppsLocale {
  const [locale, setLocale] = useState<MilosAppsLocale>(currentLocale);

  useEffect(() => subscribeToLocale(setLocale), []);

  return locale;
}
