import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';
import process from 'process';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

window.process = process;

if (typeof process.nextTick !== 'function') {
    process.nextTick = (cb) => Promise.resolve().then(cb);
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <MantineProvider withGlobalStyles withNormalizeCSS>
            <App />
        </MantineProvider>
    </StrictMode>,
);
