import React from 'react';
import '../../App.css';
import Footer from '../Footer';
import Content from '../Content';
import Collage from '../Collage';

// Import all images from the folder dynamically
function importAllImages(r) {
  return r.keys().map(r);
}

const images = importAllImages(require.context('../../../public/images/content_square/kids', false, /\.(jpg|jpeg|png)$/));

export default function Contact() {
  return (
    <>
      <div className="contact-container">
        <h1 className="header">
          Join Us At Green Pastures!
        </h1>
        <Content 
          header="Contact Ms. Ping"
          text={
            <>
              <p>Phone: (123) 456-7890</p>
              <p>Email: ms.ping@greenpastures.com</p>
              <p>WeChat: MsPing123</p>
            </>
          }
        />
        
        {/* Collage using dynamic images */}
        <Collage images={images} />
      </div>
    </>
  );
}
