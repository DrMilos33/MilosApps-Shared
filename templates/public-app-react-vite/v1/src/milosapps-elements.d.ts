import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type MilosAppsElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  slot?: string;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'milos-app-shell': MilosAppsElementProps;
      'milos-share-button': MilosAppsElementProps;
      'milos-place-search': MilosAppsElementProps;
      'milos-date-picker': MilosAppsElementProps;
    }
  }
}
