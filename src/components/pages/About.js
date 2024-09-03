import React from 'react';
import '../../App.css';
import Footer from '../Footer';
import Content from '../Content';

export default function About() {
  return (
    <>
      <h1 className='about'>ABOUT US</h1>

      <Content 
        imageSrc="images/content_square/family/img_1.jpg"
        header="Meet Huiping (Ms. Ping)"
        text="My name is Huiping. I graduated from Xi’An Jiaotong University in 2001 with a Bachelor’s Degree in Computer Science. Before coming to the United States in 2011, I taught in China for fifteen years. In 2018, I obtained my American Montessori Society Early Childhood Teacher credentials, and since 2017, I have worked with children in the Bay Area for over 8 years. I am honored to have the opportunity to teach and help children because they are truly gifts from the Lord!"
        imagePosition="left"
      />

      <Content 
        imageSrc="images/content_square/family/img_2.heic"
        header="My Family"
        text="I have three children. My son, the eldest, is a confident and bright 19-year-old studying Computer Science and Engineering at UC Davis. My two outgoing younger daughters are a blessing as well. The older one is heading to junior high, and the youngest is excited to start third grade. They are truly a blessing from God for my family."
        imagePosition="left"
      />

      <Footer />
    </>
  );
}
