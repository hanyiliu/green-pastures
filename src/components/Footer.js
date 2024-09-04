import React from 'react';
import './Footer.css';
import { Button } from './Button';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <div className='footer-container'>
      <section className='footer-subscription'>
        <p className='footer-subscription-heading'>
        Join Us at Green Pastures!
        </p>
        <Link
          to="/contact"
        >
          <Button buttonStyle='btn--outline'>Contact Us</Button>
        </Link>
      </section>
      <section class='social-media'>
        <div class='website-rights'>Green Pastures © 2024
        </div>
      </section>
    </div>
  );
}

export default Footer;
