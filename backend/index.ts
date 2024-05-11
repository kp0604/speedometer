import express, { Request, Response } from "express";
import WebSocket from "ws";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

const app = express();
const port = 4000;
const prisma: any = new PrismaClient();
const wss = new WebSocket.Server({ port: 8080 });

app.use(express.json());

//cors is handled via middleware
app.use(cors({ origin: "http://localhost:3000" }));

// sensor data type is added here
type sensorData = { speed: number; sensorName: string; timestamp: string };

// user subscribes to sensor readings and its stored here
const subscriptions = new Map<string, Set<{ ws: WebSocket }>>();

// to make batch query only when 10 entries sensorsdata is temporarily stored here
const sensorsData = new Map<string, [{ speed: number; timestamp: string }]>();

// websocket connection establishes here
wss.on("connection", (ws: WebSocket, req: any) => {
	// clientid is generated for each connection and is stored
	const clientId = uuidv4();

	// if the connection is of sensor the query contains sensorName by which we differntiate connection
	const sensorName = new URL(
		req.url || "",
		"http://localhost"
	).searchParams.get("sensorName");

	// all connections are stored in db
	saveConnection(clientId, sensorName).catch((error) => {
		console.error("Error saving WebSocket connection:", error);
		ws.send(JSON.stringify({ error: "Error saving WebSocket connection" }));
	});

	// messages over connection are handled here
	ws.on("message", (message: WebSocket.Data) => {
		handleMessage(ws, message, clientId, sensorName);
	});

	//if the connection closes the connection entry is deleted from db
	ws.on("close", () => {
		deleteConnection(clientId).catch((error) => {
			console.error("Error deleting WebSocket connection:", error);
			ws.send(JSON.stringify({ error: "Error deleting WebSocket connection" }));
		});
	});
});

// messages sent over connection are executed via this function
function handleMessage(
	ws: WebSocket,
	message: WebSocket.Data,
	clientId: string,
	sensorName: string | null
) {
	try {
		if (typeof message !== "string") {
			ws.send(JSON.stringify({ error: "Invalid message format" }));
			return;
		}
		const data = JSON.parse(message);

		//if the message is from sensor it contains speed based on that we process data
		if (data.speed) {
			data.sensorName = sensorName;
			data.clientId = clientId;
			processSensorData(data).catch((error) => {
				console.error("Error processing sensor data:", error);
				ws.send(JSON.stringify({ error: "Error processing sensor data" }));
			});
		}
		// if the message contains action as subscribe than we subscribe that sensor readings to that connection
		else if (data.action === "subscribe") {
			subscribeClient(ws, data.sensorName);
		} else {
			ws.send(JSON.stringify({ error: "Invalid message format" }));
		}
	} catch (error) {
		console.error("Error processing WebSocket message:", error);
		ws.send(JSON.stringify({ error: "Error processing WebSocket message" }));
	}
}

// sensor data is processed and saved to db via this function
async function processSensorData(data: sensorData) {
    try {
        // checking here if messages overflowed and can be stored in db
        let dataArray = sensorsData.get(data.sensorName)?.length;
        let ifQuery = dataArray && dataArray >= 10 ? true : false;

        if (ifQuery) {
            // Collect all the data that needs to be stored in a batch
            const dataToStore = sensorsData.get(data.sensorName)?.map(item => ({
                sensorName: data.sensorName,
                speed: item.speed,
                timestamp: item.timestamp,
            })) || [];

            // batch insert the collected data into the database
            await prisma.sensorData.createMany({
                data: dataToStore,
            });
        } 

		// set latest sensorsData in collection
		sensorsData.set(data.sensorName, [{ speed: data.speed, timestamp: data.timestamp }]);

        // after that sensor data is broadcasted to subscribers
        broadcastSensorData(data);
    } catch (error) {
        console.error("Error processing sensor data:", error);
        throw new Error("Error processing sensor data");
    }
}


// sensor data is broadcasted to subscribers via this function
function broadcastSensorData(data: sensorData) {
	// subscribed clients for that sensor is fetched in here
	const subscribedClients =
		subscriptions.get(data.sensorName || "") || new Set();

	// message is brodcasted to those subscribed clients
	subscribedClients.forEach((client) => {
		if (client.ws.readyState === WebSocket.OPEN) {
			client.ws.send(
				JSON.stringify({ speed: data.speed, timestamp: new Date() })
			);
		}
	});
}

// subscription for sensor messages is done via this function
function subscribeClient(ws: WebSocket, sensorName: string | null) {
	if (!sensorName) return;
	if (!subscriptions.has(sensorName)) {
		subscriptions.set(sensorName, new Set());
	}
	subscriptions.get(sensorName)?.add({ ws });
}

// web socket connection is saved to db via this function
async function saveConnection(clientId: string, sensorName: string | null) {
	try {
		await prisma.connections.create({
			data: {
				clientId,
				sensorName: sensorName || null,
			},
		});
	} catch (error) {
		console.error("Error saving WebSocket connection:", error);
		throw new Error("Error saving WebSocket connection");
	}
}

// deletion of a connection from db is done via this function
async function deleteConnection(clientId: string) {
	try {
		await prisma.connections.delete({
			where: {
				clientId,
			},
		});
	} catch (error) {
		console.error("Error deleting WebSocket connection:", error);
		throw new Error("Error deleting WebSocket connection");
	}
}

// from this api we get all connected sensors
app.get("/connected-sensors", async (req: Request, res: Response) => {
	try {
		// we differentiate sensor connection by sensorName if its null its not a sensor connection

		const connectedSensors = await prisma.connections.findMany({
			where: {
				sensorName: { not: null },
			},
			select: {
				sensorName: true,
			},
			distinct: ["sensorName"],
		});
		res.json(connectedSensors);
	} catch (error) {
		console.error("Error retrieving connected sensors:", error);
		res.status(500).json({ error: "Error retrieving connected sensors" });
	}
});

// backend server starts and listens here
app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
