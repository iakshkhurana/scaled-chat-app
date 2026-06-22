import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import roomsRoutes from './routes/rooms.routes';
import dmsRoutes from './routes/dms.routes';
import meRoutes from './routes/me.routes';
import usersRoutes from './routes/users.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/rooms', roomsRoutes);
app.use('/dms', dmsRoutes);
app.use('/me', meRoutes);
app.use('/users', usersRoutes);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`api-service listening on ${port}`));
