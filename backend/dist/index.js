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
const cors_1 = __importDefault(require("cors"));
const connections_1 = __importDefault(require("./routes/connections"));
const kafkaService_1 = require("./services/kafkaService");
const websocket_1 = require("./controllers/websocket");
const errorMiddleware_1 = require("./middlewares/errorMiddleware");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
//cors is handled via middleware
app.use((0, cors_1.default)({ origin: "http://localhost:3000" }));
(0, kafkaService_1.kafkaService)();
(0, websocket_1.websockeServer)();
app.use('/connections', connections_1.default);
app.use(errorMiddleware_1.errorHandler);
const port = 4000;
// backend server starts and listens here
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    yield shutdown();
}));
function shutdown() {
    return __awaiter(this, void 0, void 0, function* () {
        (0, kafkaService_1.removeProducer)();
        process.exit(0);
    });
}
