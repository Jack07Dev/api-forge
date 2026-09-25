import { Router } from "express";
import {
  create,
  list
} from "../controllers/organization.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", create);

router.get("/", list);

export default router;