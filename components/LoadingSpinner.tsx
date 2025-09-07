import React from 'react';

interface LoadingSpinnerProps {
  message: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      <p className="text-white text-lg mt-4">{message}</p>
    </div>
  );
};

export default LoadingSpinner;