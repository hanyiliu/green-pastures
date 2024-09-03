import React from 'react';
import './Content.css';

const Content = ({ imageSrc, header, text, imagePosition = 'left' }) => {
  const isOnlyImage = imageSrc && !text && !header;
  const isOnlyText = text && !imageSrc;
  const imageClass = isOnlyImage ? '' : 'square'; // Square image for sections with text

  return (
    <div className={`content-container ${imagePosition === 'right' ? 'reverse' : ''} ${isOnlyImage ? 'only-image' : ''} ${isOnlyText ? 'only-text' : ''}`}>
      {imageSrc && <img src={imageSrc} alt="Content" className={`content-image ${imageClass}`} />}
      {text && (
        <div className="content-text">
          {header && <div className="content-header">{header}</div>}
          {text}
        </div>
      )}
    </div>
  );
};

export default Content;
