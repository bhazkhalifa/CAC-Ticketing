import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#020617',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '520px',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#f59e0b' }}>
              Application Recovery
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.5' }}>
              An unexpected error occurred while rendering the interface.
            </p>
            {this.state.error?.message && (
              <pre style={{
                textAlign: 'left',
                backgroundColor: '#020617',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f87171',
                overflowX: 'auto',
                marginBottom: '20px',
                fontFamily: 'monospace'
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#020617',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  try { localStorage.clear(); } catch(e) {}
                  window.location.reload();
                }}
                style={{
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Reset Storage & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

