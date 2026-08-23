import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './app/App';
import { AuthGate } from './features/auth/AuthGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>{() => <App />}</AuthGate>
  </StrictMode>,
);
