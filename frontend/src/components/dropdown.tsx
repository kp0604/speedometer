import React from 'react';

interface Sensor {
  sensorName: string;
}

interface DropdownProps {
  sensors: Sensor[];
  selectedSensor: string | null;
  onSelectSensor: (sensorName: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ sensors, selectedSensor, onSelectSensor }) => {
  return (
    <div>
      <label htmlFor="sensor" className="block mb-2 font-bold">
        Choose a sensor to check readings..
      </label>
      <select
        id="sensor"
        value={selectedSensor || ''}
        onChange={(e) => onSelectSensor(e.target.value)}
        className="p-2 border border-black rounded"
      >
        <option value="">Select a sensor</option>
        {sensors.map((sensor) => (
          <option key={sensor.sensorName} value={sensor.sensorName}>
            {sensor.sensorName}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Dropdown;
