import { createRoot } from 'react-dom/client';
import { Display } from './Display';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(<Display />);
