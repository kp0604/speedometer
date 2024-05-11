"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = __importDefault(require("ws"));
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const port = 4000;
const prisma = new client_1.PrismaClient();
const wss = new ws_1.default.Server({ port: 8080 });
app.use(express_1.default.json());
//cors is handled via middleware
app.use((0, cors_1.default)({ origin: "http://localhost:3000" }));
// user subscribes to sensor readings and its stored here
const subscriptions = new Map();
// to make batch query only when 10 entries sensorsdata is temporarily stored here
const sensorsData = new Map();
// websocket connection establishes here
wss.on("connection", (ws, req) => {
    // clientid is generated for each connection and is stored
    const clientId = (0, uuid_1.v4)();
    // if the connection is of sensor the query contains sensorName by which we differntiate connection
    const sensorName = new URL(req.url || "", "http://localhost").searchParams.get("sensorName");
    // all connections are stored in db
    saveConnection(clientId, sensorName).catch((error) => {
        console.error("Error saving WebSocket connection:", error);
        ws.send(JSON.stringify({ error: "Error saving WebSocket connection" }));
    });
    // messages over connection are handled here
    ws.on("message", (message) => {
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
function handleMessage(ws, message, clientId, sensorName) {
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
        }
        else {
            ws.send(JSON.stringify({ error: "Invalid message format" }));
        }
    }
    catch (error) {
        console.error("Error processing WebSocket message:", error);
        ws.send(JSON.stringify({ error: "Error processing WebSocket message" }));
    }
}
// sensor data is processed and saved to db via this function
function processSensorData(data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            //checking here if messages overflowed and can be stored in db
            let dataArray = (_a = sensorsData.get(data.sensorName)) === null || _a === void 0 ? void 0 : _a.length;
            let ifQuery = dataArray && dataArray >= 10 ? true : false;
            if (ifQuery) {
                yield prisma.sensorData.create({
                    data: {
                        sensorName: data.sensorName,
                        speed: data.speed,
                        timestamp: new Date(),
                    },
                });
            }
            // else message is pushed in sensorsData collection
            else {
                (_b = sensorsData
                    .get(data.sensorName)) === null || _b === void 0 ? void 0 : _b.push({ speed: data.speed, timestamp: data.timestamp });
            }
            // after that sensor data is broadcasted to subscribers
            broadcastSensorData(data);
        }
        catch (error) {
            console.error("Error processing sensor data:", error);
            throw new Error("Error processing sensor data");
        }
    });
}
// sensor data is broadcasted to subscribers via this function
function broadcastSensorData(data) {
    // subscribed clients for that sensor is fetched in here
    const subscribedClients = subscriptions.get(data.sensorName || "") || new Set();
    // message is brodcasted to those subscribed clients
    subscribedClients.forEach((client) => {
        if (client.ws.readyState === ws_1.default.OPEN) {
            client.ws.send(JSON.stringify({ speed: data.speed, timestamp: new Date() }));
        }
    });
}
// subscription for sensor messages is done via this function
function subscribeClient(ws, sensorName) {
    var _a;
    if (!sensorName)
        return;
    if (!subscriptions.has(sensorName)) {
        subscriptions.set(sensorName, new Set());
    }
    (_a = subscriptions.get(sensorName)) === null || _a === void 0 ? void 0 : _a.add({ ws });
}
// web socket connection is saved to db via this function
function saveConnection(clientId, sensorName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prisma.connections.create({
                data: {
                    clientId,
                    sensorName: sensorName || null,
                },
            });
        }
        catch (error) {
            console.error("Error saving WebSocket connection:", error);
            throw new Error("Error saving WebSocket connection");
        }
    });
}
// deletion of a connection from db is done via this function
function deleteConnection(clientId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prisma.connections.delete({
                where: {
                    clientId,
                },
            });
        }
        catch (error) {
            console.error("Error deleting WebSocket connection:", error);
            throw new Error("Error deleting WebSocket connection");
        }
    });
}
// from this api we get all connected sensors
app.get("/connected-sensors", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // we differentiate sensor connection by sensorName if its null its not a sensor connection
        const connectedSensors = yield prisma.connections.findMany({
            where: {
                sensorName: { not: null },
            },
            select: {
                sensorName: true,
            },
            distinct: ["sensorName"],
        });
        res.json(connectedSensors);
    }
    catch (error) {
        console.error("Error retrieving connected sensors:", error);
        res.status(500).json({ error: "Error retrieving connected sensors" });
    }
}));
// backend server starts and listens here
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
