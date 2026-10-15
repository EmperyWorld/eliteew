import React from 'react';
import ReactDOM from 'react-dom/client';
import AppPublic from './App.public';
import './utils/suppressConnectionErrors';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppPublic />
  </React.StrictMode>
);
