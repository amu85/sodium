import React from 'react';
import NavbarMenu from '../components/NavbarMenu';
import Footer from '../components/Footer';

const MainLayout = ({ children }) => {
  return (
    <>
      <div className="body-wrapper">
        <NavbarMenu />
        <section className="main-wrapper dashboard-section">
          <div className="container-fluid">
            {children}
          </div>
        </section>
        <Footer />
      </div>
    </>
  );
};

export default MainLayout;
