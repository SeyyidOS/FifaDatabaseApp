import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/Navbar.css";

const Navbar: React.FC = () => {
  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <div className="navbar-brand">⚽ Fifa Manager</div>
        <div className="navbar-links">
          <NavLink to="/" end className="nav-link">
            Home
          </NavLink>
          <NavLink to="/leaderboard" className="nav-link">
            Leaderboard
          </NavLink>
          <NavLink to="/admin" className="nav-link">
            Admin
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
