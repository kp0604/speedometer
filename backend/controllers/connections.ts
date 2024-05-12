import express from "express";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma:any = new PrismaClient();

// from this api we get all connected sensors
export const connectedSensors = async (req :Request , res:Response) => {
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
};
