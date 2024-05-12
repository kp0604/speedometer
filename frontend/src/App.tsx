import React, { useEffect, useState } from "react";
import Dropdown from "./components/dropdown";
import Speedometer from "./components/speedometer";

interface Sensor {
  sensorName: string;
}

const App: React.FC = () => {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(0);

  useEffect(() => {
    fetchSensors();
  }, []);

  // function to fetch sesnors for subscription
  const fetchSensors = async () => {
    try {
      const response = await fetch("http://localhost:4000/connections/connected-sensors");
      const data = await response.json();
      setSensors(data);
    } catch (error) {
      console.error("Error fetching sensors:", error);
    }
  };

  // websocket connection
  const ws = new WebSocket("ws://localhost:8080");

  // get readings from sensor and set speed
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setSpeed(data.speed);
  };

  // function to handle sensor subscription change
  const handleSensorChange = (sensorName: string) => {
    setSelectedSensor(sensorName);
    ws.send(JSON.stringify({ action: "subscribe", sensorName: sensorName }));
  };

  return (
    <div className="p-4 h-screen border-8 border-orange-500 flex flex-col gap-20">
      <p className="text-4xl font-bold text-center mt-5">Sensor Dashboard</p>
      <div className="flex flex-row gap-20 justify-center items-center">
        {/* component for subscription dropdown */}
        <Dropdown
          sensors={sensors}
          selectedSensor={selectedSensor}
          onSelectSensor={handleSensorChange}
        />
        {/* component to showcase speed readings */}
        <Speedometer speed={speed} />
      </div>
    </div>
  );
}

export default App;
