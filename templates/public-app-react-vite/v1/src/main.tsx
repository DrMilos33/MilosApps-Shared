import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const host = document.querySelector<HTMLElement>('[data-milos-react-root]');
if (!host) throw new Error('Missing [data-milos-react-root] host.');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
