import { Router } from "express";
import { OrchestratorService } from "../services/orchestratorService.js";
import { StudentSnapshotSchema } from "../schemas/student.js";

const router = Router();
const service = new OrchestratorService();

router.post("/orchestrate", async (req, res, next) => {
  try {
    const parsedData = StudentSnapshotSchema.parse(req.body);
    const result = await service.run(parsedData);
    res.json(result);
  } catch (error) {
    if (error.name === "ZodError") {
      res.status(422).json({ detail: error.errors });
    } else if (error.status) {
      res.status(error.status).json({
        detail: error.detail || error.message,
        ...(error.requires_initial_assessment ? { requires_initial_assessment: true } : {}),
      });
    } else {
      next(error);
    }
  }
});

export default router;
