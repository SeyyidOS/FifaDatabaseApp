import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../styles/Navbar.css";

const Navbar: React.FC = () => {
  const [showMenu, setShowMenu] = useState(false);

  const toggleMenu = () => {
    setShowMenu((prev) => !prev);
  };

  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <div className="navbar-brand">⚽ Fifa Manager</div>
        <div className={`navbar-links ${showMenu ? "show" : ""}`}>
          <NavLink to="/" end className="nav-link" onClick={() => setShowMenu(false)}>
            Home
          </NavLink>
          <NavLink to="/leaderboard" className="nav-link" onClick={() => setShowMenu(false)}>
            Leaderboard
          </NavLink>
          <NavLink to="/admin" className="nav-link" onClick={() => setShowMenu(false)}>
            Admin
          </NavLink>
        </div>
        <div className="hamburger" onClick={toggleMenu}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
