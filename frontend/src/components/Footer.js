import React, { useEffect, useState } from "react";

import clockIcon from "../assets/images/icon/clock-icon.png";

const Footer = () => {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const TIMEZONE = process.env.REACT_APP_TIMEZONE || "Asia/Kolkata";

      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };

    updateTime(); // initial
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="footer-section">
      <div className="container-fluid">
        <div className="row">
          {/* Copyright */}
          <div className="col-xl-4 col-lg-4 col-md-5">
            <div className="copyright-text">
              <p className="mb-0">Dhruti Algo © 2025. All Rights Reserved</p>
            </div>
          </div>

          {/* Current Server Time */}
          <div className="col-xl-4 col-lg-4 col-md-3">
            <div className="current-server-time d-flex align-items-center justify-content-lg-center">
              <img src={clockIcon} alt="Clock Icon" />
              <p className="mb-0 ms-2">{currentTime || "Loading..."}</p>
            </div>
          </div>

          {/* Design Credit */}
          <div className="col-xl-4 col-lg-4 col-md-4">
            <div className="design-and-develop-text">
              <div className="d-flex align-items-center justify-content-md-start justify-content-lg-end justify-content-start">
                <p className="mb-0">Design &amp; Develop By :</p>
                <a
                  className="ms-1"
                  href="https://www.nividasoftware.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    loading="lazy"
                    src="https://www.centurypharma.com/wp-content/themes/Century%20Pharma/images/logo/nivida-logo.png"
                    alt="Nivida Logo"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
