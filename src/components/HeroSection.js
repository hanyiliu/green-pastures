import React from 'react';
import '../App.css';
import { Button } from './Button';
import './HeroSection.css';
import { Link } from 'react-router-dom/cjs/react-router-dom.min';

function HeroSection() {
  return (
    <div className='hero-container'>
      <h1>Green Pastures</h1>
      <p>“He tends his flock like a shepherd: He gathers the lambs in his arms and carries them close to his heart.”
      — Isaiah 40:11 (NIV)</p>
      <div className='hero-btns'>
        <Link
          to='/philosophy'
        >
          <Button
            className='btns'
            buttonStyle='btn--outline'
            buttonSize='btn--large'
          >
            Discover
          </Button>
        </Link>
        <Link
          to='/contact'
        >
          <Button
            className='btns'
            buttonStyle='btn--primary'
            buttonSize='btn--large'
            onClick={console.log('hey')}
          >
            Contact <i className='far fa-play-circle' />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default HeroSection;
