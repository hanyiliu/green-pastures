import React from 'react';
import './Collage.css';

export default function Collage({ images }) {
  return (
    <div className="collage-container">
      {images.map((image, index) => (
        <div key={index} className="collage-item">
          <img src={image} alt={`Collage ${index}`} />
        </div>
      ))}
    </div>
  );
}
