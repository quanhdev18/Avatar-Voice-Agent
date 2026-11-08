import { Router, type IRouter } from "express";
import healthRouter from "./health";
import senseiRouter from "./sensei";
import learnerRouter from "./learner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(senseiRouter);
router.use(learnerRouter);

export default router;
