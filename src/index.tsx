import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './src/App';
import { initializeSupabase } from './src/lib/supabase';
import './src/styles.css';

// Initialize Supabase
initializeSupabase();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
