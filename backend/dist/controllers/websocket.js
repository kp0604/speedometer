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
exports.websockeServer = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const ws_1 = __importDefault(require("ws"));
const kafkaService_1 = require("../services/kafkaService");
const prisma = new client_1.PrismaClient();
// user subscribes to sensor readings and its stored here
const subscriptions = new Map();
// websocket connection establishes here
const websockeServer = () => {
    const wss = new ws_1.default.Server({ port: 8080 });
    wss.on("connection", (ws, req) => {
        // clientid is generated for each connection and is stored
        const clientId = (0, uuid_1.v4)();
        // if the connection is of sensor the query contains sensorName by which we differntiate connection
        let sensorName = new URL(req.url || "", "http://localhost").searchParams.get("sensorName");
        sensorName = sensorName ? sensorName : "";
        // all connections are stored in db
        saveConnection(clientId, sensorName).catch((error) => {
            console.error("Error saving WebSocket connection:", error);
            ws.send(JSON.stringify({ error: "Error saving WebSocket connection" }));
        });
        // messages over connection are handled here
        ws.on("message", (data, isBinary) => {
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
};
exports.websockeServer = websockeServer;
// messages sent over connection are executed via this function
function handleMessage(ws, message, sensorName) {
    try {
        if (typeof message !== "string") {
            ws.send(JSON.stringify({ error: "Invalid message format" }));
            return;
        }
        const data = JSON.parse(message);
        //if the message is from sensor it contains speed based on that we process data
        if (data.speed) {
            let obj = { sensorName: sensorName, speed: Number(data.speed), timestamp: new Date() };
            broadcastSensorData(obj);
            //send data to message queue kafka
            (0, kafkaService_1.produceSensorReads)(obj);
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
            if (sensorName === null) {
                // create new connection entry, if sensorName null than its not sensor
                yield prisma.connections.create({
                    data: {
                        clientId,
                        sensorName: null,
                    },
                });
            }
            else {
                // upsert operation to update or create connection here if sensorName not null means its sensor
                yield prisma.connections.upsert({
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
