import express from 'express';
import cors from 'cors';
import { storage } from '../../server/storage';
import { insertMonitoringLogSchema } from '../../shared/schema';

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to receive monitoring logs in batch
app.post('/api/monitoring-logs/batch', async (req, res) => {
  try {
    const logs = req.body;
    // Validate each log (optional, but recommended)
    const parsedLogs = logs.map(log => insertMonitoringLogSchema.parse(log));
    await storage.bulkInsertMonitoringLogs(parsedLogs);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Archiver error:', err);
    res.status(500).json({ error: 'Failed to insert logs' });
  }
});

const PORT = 6001;
app.listen(PORT, () => {
  console.log(`Archiver service running on port ${PORT}`);
}); 