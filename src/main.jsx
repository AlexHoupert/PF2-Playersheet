import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './shared/auth/AuthProvider';
import { AppFeedbackProvider } from './shared/feedback/AppFeedback';
import App from './App.jsx'
import './index.css'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppFeedbackProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </AppFeedbackProvider>,
)

