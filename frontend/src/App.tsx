import { Routes, Route } from "react-router-dom";
import Navbar from "./components/NavBar";
import HomePage from "./pages/HomePage";
import Leaderboard from "./pages/LeaderBoard";
import Admin from "./pages/Admin";
import PasswordPrompt from "./components/PasswordPrompt";
import "./styles/App.css";
import React, { useState } from "react";

const PasswordProtectedAdmin: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);

  return authenticated ? (
    <Admin />
  ) : (
    <PasswordPrompt onSuccess={() => setAuthenticated(true)} />
  );
};

function App() {
  return (
    <>
      <Navbar />
      <div className="page-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin" element={<PasswordProtectedAdmin />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
