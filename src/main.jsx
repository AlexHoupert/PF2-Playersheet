import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './shared/auth/AuthProvider';
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
