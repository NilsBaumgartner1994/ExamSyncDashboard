import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import process from 'process'
window.process = process

if (typeof process.nextTick !== 'function') {
    process.nextTick = (cb) => Promise.resolve().then(cb)
}


createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
