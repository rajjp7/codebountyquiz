import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './react.css';

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="auth-page"><section className="dossier-card"><h1>The page could not be displayed</h1><p>Your accepted answers remain saved on the server.</p><button onClick={() => location.reload()}>Reload</button></section></main> : this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
