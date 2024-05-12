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
exports.connectedSensors = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// from this api we get all connected sensors
const connectedSensors = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
});
exports.connectedSensors = connectedSensors;
