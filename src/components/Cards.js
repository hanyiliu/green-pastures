import React from 'react';
import './Cards.css';
import CardItem from './CardItem';

function Cards() {
  return (
    <div className='cards'>
      <h1>Explore Our Daycare!</h1>
      <div className='cards__container'>
        <div className='cards__wrapper'>
          <ul className='cards__items'>
            <CardItem
              src='images/kids_at_circle_time.jpg'
              text='Discover Our Montessori and Christian Values Approach'
              label='Our Philosophy'
              path='/services'
            />
            <CardItem
              src='images/kids_playing_in_playground.jpg'
              text='Explore Our Educational and Play-Based Programs'
              label='Program'
              path='/services'
            />
          </ul>
          <ul className='cards__items'>
            <CardItem
              src='images/meal.jpg'
              text='Learn About Our Nutritious and Delicious Meals'
              label='Culinary'
              path='/services'
            />
            <CardItem
              src='images/ms_ping.jpg'
              text='Meet Our Team and Learn Our Story'
              label='About'
              path='/products'
            />
            <CardItem
              src='images/main_classroom.jpg'
              text='Access Enrollment Forms and Important Documents'
              label='Documents'
              path='/sign-up'
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Cards;
