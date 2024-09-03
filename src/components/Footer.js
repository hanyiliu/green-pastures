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
        <p className='footer-subscription-text'>
        Enter Your Contact Info to Begin Your Child's Adventure
        </p>
        <div className='input-areas'>
          <form>
            <input
              className='footer-input'
              name='email'
              type='email'
              placeholder='Your Email'
            />
            <Button buttonStyle='btn--outline'>Subscribe</Button>
          </form>
        </div>
      </section>
      <section class='social-media'>
        <div class='website-rights'>Green Pastures © 2024
        </div>
      </section>
    </div>
  );
}

export default Footer;
