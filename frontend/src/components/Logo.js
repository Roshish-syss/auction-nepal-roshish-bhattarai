import React, { useState } from 'react';

const Logo = ({ className = '', showText = true, textColor = 'text-blue-600', size = 'default' }) => {
  const [imageError, setImageError] = useState(false);
  
  const sizeClasses = {
    small: {
      container: 'space-x-2',
      image: 'h-8',
      icon: 'w-8 h-8 text-base',
      text: 'text-lg'
    },
    default: {
      container: 'space-x-3',
      image: 'h-10',
      icon: 'w-10 h-10 text-lg',
      text: 'text-xl'
    }
  };
  
  const classes = sizeClasses[size] || sizeClasses.default;

  return (
    <div className={`flex items-center ${classes.container} ${className}`}>
      {/* Logo Image or Fallback */}
      {imageError ? (
        <div className={`flex items-center justify-center ${classes.icon} rounded-lg bg-gradient-to-br from-amber-400 to-amber-600`}>
          <span className="text-white font-bold">AN</span>
        </div>
      ) : (
        <img 
          src="/logo.png" 
          alt="AuctionNepal Logo" 
          className={`${classes.image} w-auto`}
          onError={() => setImageError(true)}
        />
      )}
      {/* AuctionNepal Text */}
      {showText && (
        <span className={`${classes.text} font-bold ${textColor}`}>AuctionNepal</span>
      )}
    </div>
  );
};

export default Logo;

