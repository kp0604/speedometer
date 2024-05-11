// App.js
import React, { useEffect, useState } from "react";
import Dropdown from "./components/dropdown";
import Speedometer from "./components/speedometer";

function App() {
	const [sensors, setSensors] = useState([]);
	const [selectedSensor, setSelectedSensor] = useState(null);
	const [speed, setSpeed] = useState(0);


	useEffect(() => {
		console.log("yes");
		fetchSensors();
	}, []);

	const fetchSensors = async () => {
		try {
			const response = await fetch("http://localhost:4000/connected-sensors");
			const data = await response.json();
			console.log("data", data);
			setSensors(data);
		} catch (error) {
			console.error("Error fetching sensors:", error);
		}
	};

	const ws = new WebSocket("ws://localhost:8080");

	ws.onmessage = (event) => {
		const data = JSON.parse(event.data);
		console.log("yes", data);
		setSpeed(data.speed);
	};

	const handleSensorChange = (sensorName) => {
		setSelectedSensor(sensorName);
		ws.send(JSON.stringify({ action: "subscribe", sensorName: sensorName }));
	};

	return (
		<div className="p-4 h-screen border-8 border-orange-500 flex flex-col gap-20">
			<p className="text-4xl font-bold text-center mt-5">Sensor Dashboard</p>
			<div className="flex flex-row gap-20 justify-center items-center">
				<Dropdown
					sensors={sensors}
					selectedSensor={selectedSensor}
					onSelectSensor={handleSensorChange}
				/>
				<Speedometer speed={speed} />
			</div>
		</div>
	);
}

export default App;
