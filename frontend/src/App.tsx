import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import "./styles/App.css";

function App() {
  return (
    <div>
      <Navbar />
      <div className="page-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
