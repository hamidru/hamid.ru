import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import tasksRouter from "./tasks";
import attendanceRouter from "./attendance";
import leaveRouter from "./leave";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(attendanceRouter);
router.use(leaveRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);

export default router;
