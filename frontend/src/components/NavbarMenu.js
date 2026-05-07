import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ConfigContext } from "../context/ConfigContext";

import logo from '../assets/images/logo/dhruti-logo-1.png';
import clockIcon from "../assets/images/icon/clock-icon.png";
import lightModeIcon from '../assets/images/icon/light-mode-icon.png';
import nightModeIcon from '../assets/images/icon/night-mode-icon.png';
import userIcon from '../assets/images/icon/user.png';
import userListIcon from '../assets/images/icon/user-list-icon.png';
import configurationIcon from '../assets/images/icon/system-configuration.png';
import logoutIcon from '../assets/images/icon/logout-icon.png';
import { Spinner } from "react-bootstrap";

const NavbarMenu = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useContext(ConfigContext);
  const [closingTime, setClosingTime] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [mode, setMode] = useState("light");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    if (!config?.closingTime) return;

    const today = new Date();
    const [hours, minutes] = config.closingTime.split(":");
    const target = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      parseInt(hours),
      parseInt(minutes)
    );
    setClosingTime(target);
  }, [config]);

  useEffect(() => {
    const TIMEZONE = process.env.REACT_APP_TIMEZONE || "Asia/Kolkata";
    const interval = setInterval(() => {
      if (!closingTime) return;

      // Convert "now" to IST (or whatever TZ is set in .env)
      const nowString = new Date().toLocaleString("en-US", { timeZone: TIMEZONE });
      const now = new Date(nowString);

      const diff = closingTime - now;
      if (diff <= 0) {
        setCountdown("00:00:00");
        clearInterval(interval);
      } else {
        const hrs = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
        const mins = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0");
        const secs = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
        setCountdown(`${hrs}:${mins}:${secs}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [closingTime]);

  useEffect(() => {
    const savedMode = localStorage.getItem("mode") || "light";
    setMode(savedMode);
    document.body.classList.remove("light-mode", "dark-mode");
    document.body.classList.add(`${savedMode}-mode`);
  }, []);

  const toggleMode = () => {
    const newMode = mode === "dark" ? "light" : "dark";
    setMode(newMode);
    localStorage.setItem("mode", newMode);
    document.body.classList.remove("light-mode", "dark-mode");
    document.body.classList.add(`${newMode}-mode`);
  };

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  return (
    <header className="header-wrp-sec fixed-top-header with-banner">
      <nav className="navbar navbar-expand-lg">
        <div className="container-fluid">
          {/* Logo */}
          <Link className="navbar-brand" to="/">
            <img
              src={logo}
              loading="lazy"
              alt="Dhruti Logo"
            />
          </Link>

          <div className="d-flex align-items-center order-3">
            <div className="right-header-icon-wrapper d-flex align-items-center me-lg-0 me-4">
              <div className="dark-light-wrapper right-header-icon-box">
                <div className="right-header-icon">
                  <span onClick={toggleMode} style={{ cursor: "pointer" }}>
                    <img
                      src={mode === "dark" ? nightModeIcon : lightModeIcon}
                      alt="Toggle Mode"
                    />
                  </span>
                </div>
              </div>
              <div className="user-wrapper right-header-icon-box">
                <div className="right-header-icon position-relative">
                  <img
                    src={userIcon}
                    className="user-icon"
                    alt="User"
                    onClick={toggleDropdown}
                    style={{ cursor: "pointer" }}
                  />
                  <ul className={`dropdown-list ${dropdownOpen ? "show" : ""}`}>
                    <li>
                      <Link to="/users">
                        <img
                          className="me-3"
                          src={userListIcon}
                          alt=""
                        />
                        User List
                      </Link>
                    </li>
                    <li>
                      <Link to="/config">
                        <img
                          className="me-3"
                          src={configurationIcon}
                          alt=""
                        />
                        System Configuration
                      </Link>
                    </li>
                    <li>
                      <Link to="/quantity-freeze-limits">
                        <img
                          className="me-3"
                          src={configurationIcon}
                          alt=""
                        />
                        Quantity Freeze Limits
                      </Link>
                    </li>
                    <li>
                      <Link to="/monitoring">
                        <img
                          className="me-3"
                          src={configurationIcon}
                          alt=""
                        />
                        Monitoring
                      </Link>
                    </li>
                    <li>
                      <Link to="/analysis">
                        <img
                          className="me-3"
                          src={configurationIcon}
                          alt=""
                        />
                        Analysis
                      </Link>
                    </li>
                    <li>
                      <Link to="/intraday">
                        <img
                          className="me-3"
                          src={configurationIcon}
                          alt=""
                        />
                        Intraday
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={handleLogout}
                        className="dropdown-item border-0 bg-transparent"
                      >
                        <img
                          className="me-3"
                          src={logoutIcon}
                          alt=""
                        />
                        Logout
                      </button>
                    </li>
                  </ul>

                </div>
              </div>
            </div>

            {/* Mobile Toggle */}
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="offcanvas"
              data-bs-target="#offcanvasNavbar"
              aria-controls="offcanvasNavbar"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
          </div>

          {/* Offcanvas Menu */}
          <div
            className="offcanvas offcanvas-end"
            tabIndex="-1"
            id="offcanvasNavbar"
            aria-labelledby="offcanvasNavbarLabel"
          >
            <div className="offcanvas-header">
              <div className="offcanvas-logo">
                <img
                  src={logo}
                  loading="lazy"
                  alt="Dhruti Logo"
                />
              </div>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="offcanvas"
                aria-label="Close"
              ></button>
            </div>
            <div className="offcanvas-body">
              <ul className="navbar-nav m-auto mb-2 mb-lg-0">
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/" ? "active" : ""
                    }`}
                    to="/"
                  >
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/healthcheck" ? "active" : ""
                    }`}
                    to="/healthcheck"
                  >
                    Healthcheck
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/create-new-trade" ? "active" : ""
                    }`}
                    to="/create-new-trade"
                  >
                    Create New Trade
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/orders" ? "active" : ""
                    }`}
                    to="/orders"
                  >
                    Orders
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/close-existing" ? "active" : ""
                    }`}
                    to="/close-existing"
                  >
                    Close Existing
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/algo" ? "active" : ""
                    }`}
                    to="/algo"
                  >
                    Algo
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="d-md-flex right-header-wrapper">
            <div className="timer-wrapper d-flex align-items-center">
              <img src={clockIcon} alt="Clock" />
              <div className="ms-1">
                {countdown === "" ? (
                  <Spinner size="sm" animation="border" variant="light" />
                ) : countdown === "00:00:00" ? (
                  <span className="text-danger fw-bold">Time Out</span>
                ) : (
                  countdown
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default NavbarMenu;
