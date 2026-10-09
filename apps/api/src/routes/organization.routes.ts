import { Router } from "express";
import {
  create,
  list,
  getById,
  archive
} from "../controllers/organization.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", create);
router.get("/", list);
router.get("/:organizationId", getById);
router.patch("/:organizationId/archive", archive);

export default router;