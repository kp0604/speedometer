import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";
import { sensorData } from '../types/sensor';
import { produceSensorReads } from "../services/kafkaService";

const prisma:any = new PrismaClient();

// user subscribes to sensor readings and its stored here
const subscriptions = new Map<string, Set<{ ws: WebSocket }>>();

// websocket connection establishes here
export const websockeServer = () => {
    const wss = new WebSocket.Server({ port: 8080 });
    wss.on("connection", (ws: WebSocket, req: any) => {
        // clientid is generated for each connection and is stored
        const clientId = uuidv4();

        // if the connection is of sensor the query contains sensorName by which we differntiate connection
        let sensorName = new URL(
            req.url || "",
            "http://localhost"
        ).searchParams.get("sensorName");

        sensorName = sensorName ? sensorName : ""

        // all connections are stored in db
        saveConnection(clientId, sensorName).catch((error) => {
            console.error("Error saving WebSocket connection:", error);
            ws.send(JSON.stringify({ error: "Error saving WebSocket connection" }));
        });
        // messages over connection are handled here
        ws.on("message", (data: WebSocket.Data, isBinary) => {
            const message = isBinary ? data : data.toString();
            handleMessage(ws, message, sensorName);
        });

        //if the connection closes the connection entry is deleted from db
        ws.on("close", () => {
            deleteConnection(clientId).catch((error) => {
                console.error("Error deleting WebSocket connection:", error);
                ws.send(JSON.stringify({ error: "Error deleting WebSocket connection" }));
            });
        });
    });
}

// messages sent over connection are executed via this function
function handleMessage(
    ws: WebSocket,
    message: WebSocket.Data,
    sensorName: string,
) {
    try {
        if (typeof message !== "string") {
            ws.send(JSON.stringify({ error: "Invalid message format" }));
            return;
        }
        const data = JSON.parse(message);

        //if the message is from sensor it contains speed based on that we process data
        if (data.speed) {
            let obj = { sensorName: sensorName, speed: Number(data.speed), timestamp: new Date() }
            broadcastSensorData(obj);

            //send data to message queue kafka
            produceSensorReads(obj)

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
        if (sensorName === null) {
            // create new connection entry, if sensorName null than its not sensor
            await prisma.connections.create({
                data: {
                    clientId,
                    sensorName: null,
                },
            });
        } else {
            // upsert operation to update or create connection here if sensorName not null means its sensor
            await prisma.connections.upsert({
                where: {
                    sensorName,
                },
                update: {
                    clientId,
                },
                create: {
                    clientId,
                    sensorName,
                },
            });
        }
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