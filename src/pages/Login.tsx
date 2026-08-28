import React, { useState } from 'react';
import '../styles/Login.css';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenForm, setShowTokenForm] = useState(false);

  const testToken = async (token: string): Promise<any | null> => {
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        method: 'GET',
        headers: { 
          'Authorization': token,
          'Content-Type': 'application/json',
        },
      });

      console.log('Token test response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Token test error:', errorData);
        throw new Error(`Discord API error: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('Token test exception:', err);
      throw err;
    }
  };

  const handleDiscordLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setShowTokenForm(true);
    } catch (err: any) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokenInput.trim()) {
      setError('Please paste your token');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const user = await testToken(tokenInput);
      if (user) {
        onLogin(tokenInput, user);
      }
    } catch (err: any) {
      setError(
        'Token validation failed. Make sure:\n' +
        '✓ You copied the ENTIRE token\n' +
        '✓ There are no extra spaces\n' +
        '✓ The token is fresh (not expired)\n\n' +
        'Error: ' + err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Discord DM Manager</h1>
        <p className="subtitle">Send messages to multiple Discord friends</p>

        {!showTokenForm ? (
          <>
            <button 
              onClick={handleDiscordLogin} 
              disabled={loading} 
              className="login-btn"
            >
              {loading ? 'Loading...' : 'Login with Discord'}
            </button>

            {error && <div className="error-message">{error}</div>}

            <div className="info-section">
              <h3>📝 How it works:</h3>
              <ol>
                <li>Click "Login with Discord"</li>
                <li>Follow the instructions to get your token</li>
                <li>Select friends to message</li>
                <li>Send bulk messages with one click!</li>
              </ol>
              <p className="security-note">
                ⚠️ <strong>Security:</strong> Your token is only used locally in this app.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="token-form-container">
              <h3>📋 Enter Your Discord Token</h3>
              
              <form onSubmit={handleTokenSubmit}>
                <div className="form-group">
                  <label htmlFor="token">Your Discord Token:</label>
                  <textarea
                    id="token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste your complete Discord token here..."
                    className="token-textarea"
                    rows={4}
                    disabled={loading}
                  />
                </div>

                <div className="button-group">
                  <button 
                    type="submit" 
                    disabled={loading || !tokenInput.trim()}
                    className="login-btn submit-btn"
                  >
                    {loading ? 'Validating...' : 'Login'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowTokenForm(false);
                      setTokenInput('');
                      setError('');
                    }}
                    className="cancel-btn"
                  >
                    Back
                  </button>
                </div>
              </form>

              {error && (
                <div className="error-message">
                  {error.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}

              <div className="token-instructions">
                <h4>🔍 METHOD 1: Storage Tab (Recommended - Easiest)</h4>
                <ol>
                  <li><strong>Open Discord</strong> in your web browser (discord.com)</li>
                  <li><strong>Press F12</strong> to open Developer Tools</li>
                  <li><strong>Click "Application"</strong> tab (or "Storage" in Firefox)</li>
                  <li><strong>Click "Local Storage"</strong> in the left menu</li>
                  <li><strong>Click "https://discord.com"</strong> from the list</li>
                  <li><strong>Find "token"</strong> in the table (scroll if needed)</li>
                  <li><strong>Copy the VALUE</strong> (the long string in the right column)</li>
                  <li><strong>Paste it above</strong> and click Login</li>
                </ol>

                <h4 style={{ marginTop: '20px' }}>🔍 METHOD 2: Network Tab (Alternative)</h4>
                <ol>
                  <li><strong>Open Discord</strong> in web browser</li>
                  <li><strong>Press F12</strong> and go to "Network" tab</li>
                  <li><strong>Reload the page</strong> (F5)</li>
                  <li><strong>Find any request</strong> to discord.com/api</li>
                  <li><strong>Look at "Request Headers"</strong></li>
                  <li><strong>Find "Authorization"</strong> header</li>
                  <li><strong>Copy that full value</strong></li>
                  <li><strong>Paste it above</strong> and click Login</li>
                </ol>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
