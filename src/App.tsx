import React, { useState } from 'react';
import './App.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [discordToken, setDiscordToken] = useState('');
  const [userData, setUserData] = useState<any>(null);

  const handleLogin = (token: string, user: any) => {
    setDiscordToken(token);
    setUserData(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setDiscordToken('');
    setUserData(null);
    setIsAuthenticated(false);
  };

  return (
    <div className="App">
      {!isAuthenticated ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard token={discordToken} userData={userData} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
