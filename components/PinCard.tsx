import React from 'react';
import { Pin } from '../types';

interface PinCardProps {
  pin: Pin;
  isSelected: boolean;
  onSelect: (pin: Pin) => void;
  canSelect: boolean;
  onView: (url: string) => void;
}

const PinCard: React.FC<PinCardProps> = ({ pin, isSelected, onSelect, canSelect, onView }) => {
  const handleSelect = () => {
    if (isSelected || canSelect) {
      onSelect(pin);
    }
  };
  
  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the card from being selected when clicking the icon
    onView(pin.images.orig.url);
  };

  const title = pin.title || pin.description || 'Untitled Pin';
  const truncatedTitle = title.length > 50 ? `${title.substring(0, 50)}...` : title;

  return (
    <div className="relative break-inside-avoid mb-4 group cursor-pointer" onClick={handleSelect}>
      <img src={pin.images.orig.url} alt={title} className="w-full rounded-lg shadow-md" />
      {/* This overlay is for selection state and hover effect */}
      <div className={`absolute inset-0 rounded-lg transition-all duration-300 z-10 ${isSelected ? 'ring-4 ring-yellow-500 bg-black/30' : 'bg-black bg-opacity-0 group-hover:bg-opacity-50'}`}></div>
      
      {/* Full-screen view button. z-20 ensures it's on top of the z-10 overlay */}
      <div 
        onClick={handleViewClick}
        className="absolute top-2 left-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/80 z-20"
        title="View full screen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
        </svg>
      </div>

      {/* Selection checkbox indicator. z-20 ensures it's on top */}
      <div className="absolute top-2 right-2 z-20">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-yellow-500 border-2 border-white' : 'bg-gray-800 bg-opacity-50 border-2 border-transparent group-hover:bg-opacity-80'}`}>
          {isSelected && (
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          )}
        </div>
      </div>

      {/* Title overlay. z-20 ensures it's on top */}
      <div className="absolute bottom-0 left-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity w-full bg-gradient-to-t from-black/80 to-transparent rounded-b-lg z-20">
        <p className="text-sm font-semibold drop-shadow-md">{truncatedTitle}</p>
      </div>
    </div>
  );
};

export default PinCard;