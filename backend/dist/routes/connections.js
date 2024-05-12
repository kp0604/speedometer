"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const connections_1 = require("../controllers/connections");
const router = express_1.default.Router();
router.get('/connected-sensors', connections_1.connectedSensors);
exports.default = router;
