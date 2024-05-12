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
Object.defineProperty(exports, "__esModule", { value: true });
exports.produceSensorReads = exports.kafkaService = exports.removeProducer = void 0;
const kafkajs_1 = require("kafkajs");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
//kafka message queue is initialized from here
const kafka = new kafkajs_1.Kafka({
    clientId: 'speedometer',
    brokers: ['kafka:9092'],
});
let producer;
//creates producer 
const createProducer = () => __awaiter(void 0, void 0, void 0, function* () {
    producer = kafka.producer();
    yield producer.connect();
});
//creates topic
const kafkaInit = () => __awaiter(void 0, void 0, void 0, function* () {
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
            }),
        });
    }
    catch (error) {
        console.error('Error occurred in consumer:', error);
    }
});
//function to remove producer when backend stops
const removeProducer = () => __awaiter(void 0, void 0, void 0, function* () {
    yield producer.disconnect();
});
exports.removeProducer = removeProducer;
// creates topic , starts producer consumer
const kafkaService = () => {
    // start admin and create topic and create producer
    kafkaInit();
    // start consumer listen
    startConsumer().catch(console.error);
};
exports.kafkaService = kafkaService;
// sensor data is pushed to message queue via this
const produceSensorReads = (data) => __awaiter(void 0, void 0, void 0, function* () {
    // connect to kafka producer
    console.log('pr2', producer);
    try {
        yield producer.send({
            topic: 'sensor_data',
            messages: [{ value: JSON.stringify(data) }]
        });
    }
    catch (error) {
        console.error('Error occurred in producer:', error);
    }
    finally {
    }
});
exports.produceSensorReads = produceSensorReads;
