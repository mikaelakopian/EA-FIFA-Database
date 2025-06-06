import React from "react";

interface RangeSliderProps {
  value: [number, number];
  onChange: (value: number | number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  color?: "foreground" | "primary" | "secondary" | "success" | "warning" | "danger";
  showTooltip?: boolean;
  label?: string;
  className?: string;
}

const colorMap = {
  foreground: "#11181C",
  primary: "#006FEE",
  secondary: "#9353D3",
  success: "#17C964",
  warning: "#F5A524",
  danger: "#F31260"
};

export const RangeSlider: React.FC<RangeSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  color = "success",
  showTooltip = true,
  label,
  className = "w-full"
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = React.useState(false);
  const sliderColor = colorMap[color];
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: 0 | 1) => {
    const newValue = parseInt(e.target.value);
    const newRange: [number, number] = [...value] as [number, number];
    
    if (index === 0 && newValue <= value[1]) {
      newRange[0] = newValue;
    } else if (index === 1 && newValue >= value[0]) {
      newRange[1] = newValue;
    }
    
    onChange(newRange);
  };

  const percentage0 = ((value[0] - min) / (max - min)) * 100;
  const percentage1 = ((value[1] - min) / (max - min)) * 100;

  return (
    <div className={className}>
      <div 
        className="relative h-2 bg-gray-200 rounded-lg"
        onMouseEnter={() => showTooltip && setIsTooltipVisible(true)}
        onMouseLeave={() => showTooltip && setIsTooltipVisible(false)}
      >
        {/* Active range */}
        <div
          className="absolute h-2 rounded-lg"
          style={{
            backgroundColor: sliderColor,
            left: `${percentage0}%`,
            width: `${percentage1 - percentage0}%`,
          }}
        />
        
        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => handleChange(e, 0)}
          className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer range-slider"
          aria-label={`${label} minimum value`}
        />
        
        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[1]}
          onChange={(e) => handleChange(e, 1)}
          className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer range-slider"
          aria-label={`${label} maximum value`}
        />

        {/* Tooltips */}
        {showTooltip && isTooltipVisible && (
          <>
            <div
              className="absolute -top-8 px-2 py-1 text-xs text-white bg-gray-800 rounded transform -translate-x-1/2"
              style={{ left: `${percentage0}%` }}
            >
              {value[0]}
            </div>
            <div
              className="absolute -top-8 px-2 py-1 text-xs text-white bg-gray-800 rounded transform -translate-x-1/2"
              style={{ left: `${percentage1}%` }}
            >
              {value[1]}
            </div>
          </>
        )}
      </div>
    </div>
  );
};