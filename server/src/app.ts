import express from 'express';
import { errorHandler } from './http.ts';
import { appointmentRoutes } from './appointments/routes.ts';
import { healthRoutes } from './health/routes.ts';
import { patientRoutes } from './patients/routes.ts';
import { staffRoutes } from './staff/routes.ts';

export const app = express();
app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);

// Express 5 forwards rejected promises here, so routes don't need try/catch.
app.use(errorHandler);
