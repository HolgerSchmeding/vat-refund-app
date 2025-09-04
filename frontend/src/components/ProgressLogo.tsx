import React from 'react';
import './ProgressLogo.css';

interface ProgressLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export const ProgressLogo: React.FC<ProgressLogoProps> = ({ 
  width = 120, 
  height = 40, 
  className = "" 
}) => {
  return (
    <div className={`progress-logo ${className}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 120 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Purple arrows/chevrons */}
        <g>
          <path
            d="M8 12L16 20L8 28"
            stroke="#8B5CF6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M16 12L24 20L16 28"
            stroke="#8B5CF6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
        
        {/* "pro.gress" text */}
        <text
          x="32"
          y="26"
          fill="#1F2937"
          fontSize="16"
          fontWeight="600"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          pro.gress
        </text>
      </svg>
    </div>
  );
};
