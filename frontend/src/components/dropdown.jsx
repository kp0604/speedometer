// // Dropdown.js
import React from 'react';

function Dropdown({ sensors, selectedSensor, onSelectSensor }) {
  return (
    <div>
      <label htmlFor="sensor" className="block mb-2 font-bold">Choose a sensor to check readings..</label>
      <select
        id="sensor"
        value={selectedSensor}
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


