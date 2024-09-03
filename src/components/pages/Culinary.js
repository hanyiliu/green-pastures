import React from 'react';
import '../../App.css';
import Footer from '../Footer';
import Content from '../Content';

export default function Culinary() {
  return (
    <>
      <h1 className='culinary'>OUR CULINARY OFFERINGS</h1>
      <h1> Sample Menu</h1>
      <Content 
        imageSrc="images/sample_menu.png"
      />

      <Content 
        imageSrc="images/content_square/food/img_1.jpg"
        header="Daily Meals and Snacks"
        text="We provide a nutritious breakfast, morning snack, lunch, and afternoon snack after nap time. Each meal is thoughtfully prepared to ensure your child gets the energy they need for a day full of activities and learning."
        imagePosition="left"
      />

      <Content 
        imageSrc="images/content_square/food/img_3.jpg"
        header="Fresh, Organic, and Healthy"
        text="All of our food is made in-house, using the best organic and healthy ingredients. We are dedicated to offering meals that are both delicious and nutritious to support your child’s growth and well-being."
        imagePosition="right"
      />

      <Content 
        imageSrc="images/content_square/food/img_4.jpg"
        header="A Blend of Cuisines"
        text="We follow a diverse menu featuring a blend of Asian and American cuisine. This approach allows children to experience a wide variety of flavors and textures, fostering an appreciation for different cultures."
        imagePosition="left"
      />

      <Footer />
    </>
  );
}
