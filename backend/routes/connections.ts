import express from "express";
import { connectedSensors } from '../controllers/connections'
const router = express.Router();

router.get('/connected-sensors', connectedSensors)
  
export default router;
  