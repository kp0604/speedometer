import React from 'react';

interface SpeedometerProps {
  speed: number;
}

const Speedometer: React.FC<SpeedometerProps> = ({ speed }) => {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-3 text-center">Speedometer</h3>
      <div className="bg-gray-200 w-40 h-40 rounded-full flex items-center justify-center">
        <h1 className="text-4xl font-bold">{speed ? speed : 0}</h1>
      </div>
    </div>
  );
}

export default Speedometer;
