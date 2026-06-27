import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'highlight.js/styles/atom-one-dark.css'
import App from './App.jsx'
import { ToastProvider } from './components/Toast'
import { DialogProvider } from './components/DialogContext'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <StrictMode>
      <ToastProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </ToastProvider>
    </StrictMode>
  </ErrorBoundary>,
)
