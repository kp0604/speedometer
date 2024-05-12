import { Kafka,EachBatchPayload,} from 'kafkajs';
import { sensorData } from '../types/sensor';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

//kafka message queue is initialized from here
const kafka = new Kafka({
	clientId: 'speedometer',
	brokers: ['kafka:9092'],
})

let producer: any

//creates producer 
const createProducer = async () => {
	producer = kafka.producer();
	await producer.connect();
}

//creates topic
const kafkaInit = async () => {
	const admin = kafka.admin();
	console.log("Admin connecting...");
	admin.connect();
	console.log("Admin Connection Success...");

	console.log("Creating Topic [sensor_data]");
	await admin.createTopics({
		topics: [
			{
				topic: "sensor_data",
				numPartitions: 1,
			},
		],
	});

	await createProducer()

	console.log("Topic Created Success [sensor_data]");

	console.log("Disconnecting Admin..");
	await admin.disconnect();
}

// consumer is added to get messages from message queue via this
const startConsumer = async () => {
	const consumer = kafka.consumer({ groupId: 'group1' });

	try {
		await consumer.connect();
		await consumer.subscribe({ topic: 'sensor_data', fromBeginning: true });


		await consumer.run({
			eachBatch: async ({ batch, resolveOffset, heartbeat }: EachBatchPayload) => {

				//process messages
				let data:any = batch.messages.map((ele: any) => {
					let obj = JSON.parse(ele.value)
					obj.speed = Number(obj.speed)
					return { sensorName: obj.sensorName, speed: obj.speed, timestamp: obj.timestamp }
				})

				//create batch query to add readings in db
				await prisma.sensorData.createMany({
					data: data
				});

				// commit offsets to Kafka
				await resolveOffset(batch.messages[batch.messages.length - 1].offset);

				// sending a heartbeat
				await heartbeat();

			},
		});

	} catch (error) {
		console.error('Error occurred in consumer:', error);
	}
};

//function to remove producer when backend stops
export const removeProducer = async () => {
	await producer.disconnect();
}

// creates topic , starts producer consumer
export const kafkaService = () => {

	// start admin and create topic and create producer
	kafkaInit()

	// start consumer listen
	startConsumer().catch(console.error)

}

// sensor data is pushed to message queue via this
export const produceSensorReads = async (data: sensorData) => {
	// connect to kafka producer
	try {
		await producer.send({
			topic: 'sensor_data',
			messages: [{ value: JSON.stringify(data) }]
		});
	} catch (error) {
		console.error('Error occurred in producer:', error);
	} finally {

	}
};