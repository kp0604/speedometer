import express from "express";
import cors from "cors";
import connections from "./routes/connections";
import { removeProducer, kafkaService } from "./services/kafkaService";
import { websockeServer } from "./controllers/websocket";
import { errorHandler } from "./middlewares/errorMiddleware";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//cors is handled via middleware
app.use(cors({ origin: "http://localhost:3000" }));

//start kafka service
kafkaService()
//start websocket server
websockeServer()

//route to handle connected sensors
app.use('/connections', connections)

//middleware to handle errors
app.use(errorHandler)

const port = 4000;
// backend server starts and listens here
app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

process.on('SIGTERM', async () => {
	await shutdown();
});

async function shutdown() {

	//remove producer when stops
	removeProducer()

	process.exit(0);
}

