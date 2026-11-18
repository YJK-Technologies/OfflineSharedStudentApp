import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, setCustomApiUrl, normalizeApiUrl, checkServerHealthDetailed } from '../services/apiService';

export default function ServerConfigModal({ isOpen, onClose, onServerConfigured }) {
  const [url, setUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(getApiBaseUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    const normalized = normalizeApiUrl(url);
    setUrl(normalized);
    setCustomApiUrl(normalized);

    const result = await checkServerHealthDetailed(5000);

    if (result.ok) {
      setTestResult({
        success: true,
        message: `Connected successfully to ${result.url}!`
      });
    } else {
      setTestResult({
        success: false,
        message: `Failed (${result.error}). Check: (1) Same Wi-Fi IP or Tunnel URL, (2) Backend running on port 5000, (3) Windows Firewall allows TCP 5000.`
      });
    }
    setIsTesting(false);
  };

  const handleSave = async () => {
    const normalized = normalizeApiUrl(url);
    setCustomApiUrl(normalized);
    onServerConfigured();
    onClose();
  };

  const handleResetDefault = () => {
    setCustomApiUrl('');
    const defaultUrl = getApiBaseUrl();
    setUrl(defaultUrl);
    setTestResult(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Server Connection Settings</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        <div className="student-form">
          <p className="modal-description">
            Configure the Node.js + SQLite Central Backend address for synchronization.
          </p>

          <div className="form-group">
            <label htmlFor="backend-api-url" className="form-label">
              Backend API URL
            </label>
            <input
              id="backend-api-url"
              type="url"
              className="form-input"
              placeholder="e.g. http://192.168.1.15:5000 or https://xxxx.trycloudflare.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
            />
          </div>

          {testResult && (
            <div className={`test-result-banner ${testResult.success ? 'success' : 'error'}`}>
              {testResult.message}
            </div>
          )}

          <div className="modal-help-box">
            <strong>Same Wi-Fi (Local Network):</strong><br />
            Enter your PC's Wi-Fi IPv4 from <code>ipconfig</code>, e.g. <code>http://192.168.1.15:5000</code>.<br /><br />
            <strong>Mobile Data (4G/5G / Different Network):</strong><br />
            Run <code>cloudflared tunnel --url http://localhost:5000</code> on your PC and paste the public <code>https://...trycloudflare.com</code> URL above.
          </div>

          <div className="server-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetDefault}
            >
              Reset Default
            </button>

            <div className="server-modal-footer-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTest}
                disabled={isTesting}
              >
                {isTesting ? 'Testing...' : 'Test'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
