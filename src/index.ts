import express from 'express';
import cors from 'cors';
import { db } from './db';
import { users } from './db/schema';
import userRoutes from './routes/users';
import contactRoutes from './routes/contacts';
import assistantRoutes from './routes/assistant';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/assistant', assistantRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);

    // Verify DB connection
    db.select().from(users).limit(1)
        .then(() => console.log('Successfully connected to database!'))
        .catch((err) => console.error('Error connecting to database:', err));

    setInterval(() => { }, 60000);
});
