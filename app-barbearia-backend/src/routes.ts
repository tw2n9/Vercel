import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes";
import { barberRoutes } from "./modules/barbers/barbers.routes";
import { bookingRoutes } from "./modules/bookings/bookings.routes";
import { clientRoutes } from "./modules/clients/clients.routes";
import { notificationRoutes } from "./modules/notifications/notifications.routes";
import { scheduleRoutes } from "./modules/schedules/schedules.routes";
import { serviceRoutes } from "./modules/services/services.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { userRoutes } from "./modules/users/users.routes";

export const routes = Router();

routes.use("/auth", authRoutes);
routes.use("/users", userRoutes);
routes.use("/services", serviceRoutes);
routes.use("/barbers", barberRoutes);
routes.use("/schedules", scheduleRoutes);
routes.use("/bookings", bookingRoutes);
routes.use("/clients", clientRoutes);
routes.use("/notifications", notificationRoutes);
routes.use("/settings", settingsRoutes);
