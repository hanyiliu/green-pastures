import React from 'react';
import '../../App.css';
import Footer from '../Footer';
import Content from '../Content';

export default function Philosophy() {
  return (
    <>
      <h1 className='philosophy'>OUR PHILOSOPHY</h1>
      <Content 
        imageSrc="images/content_square/kids/img_1.jpg"
        header="Green Pastures’ Mission"
        text="Our mission is to nurture healthy nutrition, encourage independence and self-motivation, develop critical thinking skills, improve social skills, support emotional development, enhance creativity and imagination, foster a love of learning, develop fine motor skills, encourage problem-solving, and support language development. We strive to make our school a fun, engaging, safe, nurturing, and productive learning environment, preparing children for future success."
        imagePosition="left"
      />
      <Content 
        imageSrc="images/content_square/kids/img_2.jpg"
        header="Engaging Learning Environment"
        text="Our school day is planned around weekly themes, including Montessori activities, holidays, nursery rhymes, fruits, animals, plants, and more. Children will explore topics like colors, alphabets, seasons, shapes, numbers, and patterns. Through these activities, children learn, play, and work together, enhancing their communication and social skills while gaining knowledge in these themes. We aim to make learning so enjoyable that children are excited to come to school each day."
        imagePosition="right"
      />
      <Content 
        imageSrc="images/content_square/kids/img_3.jpg"
        header="Commitment to a Safe and Nurturing Environment"
        text="We are committed to building a safe and natural environment for the children at Green Pastures. A special thank you to my husband and children for their help, and to the parents for their suggestions, encouragement, and support. We hope that the children who grow up at Green Pastures will be happy and healthy, both physically and mentally, and we will work tirelessly to ensure this is accomplished."
        imagePosition="left"
      />
      
      <Footer />
    </>
  );
}
