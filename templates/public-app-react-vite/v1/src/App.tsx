import { useEffect, useState } from 'react';
import { signalReady } from './milosapps-bridge';
import { useMilosAppsLocale } from './use-milosapps-locale';

const copy = {
  de: {
    eyebrow: 'Optionale React-Appschicht',
    title: 'Ein kleiner, klar begrenzter React-Root',
    description: 'Shell, Loader und Shared-Verträge bleiben frameworkneutral.',
    action: 'Beispiel ausführen',
    count: (value: number) => `Ausgeführt: ${value}`,
  },
  en: {
    eyebrow: 'Optional React app layer',
    title: 'One small, explicitly bounded React root',
    description: 'Shell, loader and Shared contracts stay framework-neutral.',
    action: 'Run example',
    count: (value: number) => `Runs: ${value}`,
  },
} as const;

export default function App() {
  const locale = useMilosAppsLocale();
  const text = copy[locale];
  const [count, setCount] = useState(0);

  useEffect(() => {
    signalReady();
  }, []);

  return (
    <section className="react-stage" aria-labelledby="react-title">
      <p className="react-stage__eyebrow">{text.eyebrow}</p>
      <h1 id="react-title">{text.title}</h1>
      <p>{text.description}</p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        {text.action}
      </button>
      <output aria-live="polite">{text.count(count)}</output>
    </section>
  );
}
