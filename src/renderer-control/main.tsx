import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LocaleProvider } from './i18n';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <LocaleProvider>
    <App />
  </LocaleProvider>,
);
