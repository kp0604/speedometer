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
const { Kafka, EachBatchPayload } = require('kafkajs');
//kafka message queue is initialized from here
const kafka = new Kafka({
    clientId: 'speedometer',
    brokers: ['kafka:9092'],
});
let producer;
const createProducer = () => __awaiter(void 0, void 0, void 0, function* () {
    producer = kafka.producer();
    yield producer.connect();
});
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        const admin = kafka.admin();
        console.log("Admin connecting...");
        admin.connect();
        console.log("Admin Connection Success...");
        console.log("Creating Topic [sensor_reads]");
        yield admin.createTopics({
            topics: [
                {
                    topic: "sensor_data",
                    numPartitions: 1,
                },
            ],
        });
        yield createProducer();
        console.log("Topic Created Success [rider-updates]");
        console.log("Disconnecting Admin..");
        yield admin.disconnect();
    });
}
init();
app.use(express_1.default.json());
//cors is handled via middleware
app.use((0, cors_1.default)({ origin: "http://localhost:3000" }));
;
// user subscribes to sensor readings and its stored here
const subscriptions = new Map();
// sensor data is pushed to message queue via this
const produceSensorReads = (sensorData) => __awaiter(void 0, void 0, void 0, function* () {
    // connect to kafka producer
    console.log('pr2', producer);
    try {
        yield producer.send({
            topic: 'sensor_data',
            messages: [{ value: JSON.stringify(sensorData) }]
        });
        console.log('from producer', sensorData);
    }
    catch (error) {
        console.error('Error occurred in producer:', error);
    }
    finally {
    }
});
// consumer is added to get messages from message queue via this
const startConsumer = () => __awaiter(void 0, void 0, void 0, function* () {
    const consumer = kafka.consumer({ groupId: 'group1' });
    console.log('yes');
    try {
        yield consumer.connect();
        yield consumer.subscribe({ topic: 'sensor_data', fromBeginning: true });
        yield consumer.run({
            eachBatch: (_a) => __awaiter(void 0, [_a], void 0, function* ({ batch, resolveOffset, heartbeat }) {
                console.log('batch');
                let data = batch.messages.map((ele) => {
                    let obj = JSON.parse(ele.value);
                    obj.speed = Number(obj.speed);
                    return { sensorName: obj.sensorName, speed: obj.speed, timestamp: obj.timestamp };
                });
                console.log('batchdata', data);
                yield prisma.sensorData.createMany({
                    data: data
                });
                // commit offsets to Kafka
                yield resolveOffset(batch.messages[batch.messages.length - 1].offset);
                // sending a heartbeat
                yield heartbeat();
                yield consumer.commitOffsets([
                    {
                        topic: batch.topic,
                        partition: batch.partition,
                        offset: Kafka.OffsetCommitRequest.EARLIEST_OFFSET,
                    },
                ]);
            }),
        });
    }
    catch (error) {
        console.error('Error occurred in consumer:', error);
    }
});
// start consumer listen
startConsumer().catch(console.error);
// websocket connection establishes here
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
            console.log('pr1', producer);
            produceSensorReads(obj);
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
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    yield shutdown();
}));
function shutdown() {
    return __awaiter(this, void 0, void 0, function* () {
        if (producer) {
            yield producer.disconnect();
        }
        process.exit(0);
    });
}
// backend server starts and listens here
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
