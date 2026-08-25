// Force IPv4 DNS resolution to fix querySrv ECONNREFUSED on IPv6 networks
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
// Use public resolvers for the mongodb+srv SRV/TXT lookup. Some local/router
// DNS servers refuse SRV queries, causing querySrv ECONNREFUSED at startup.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const { Server } = require('socket.io');
const Hospital = require('./models/Hospital');
const Consultant = require('./models/Consultant');
const Laboratory = require('./models/Laboratory');
const { processReferralEscalations } = require('./jobs/referralEscalation');
const { ensurePlatformData } = require('./bootstrap/ensurePlatformData');
const { setIO } = require('./socket');

// Load env vars
dotenv.config();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// CORS allowlist. Set CORS_ORIGINS to a comma-separated list of origins in
// production; leave it blank to allow all origins (development default).
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsOrigin = corsOrigins.length > 0 ? corsOrigins : '*';

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

app.set('io', io);
// Expose io to services/jobs that don't have access to `req`.
setIO(io);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const referralRoutes = require('./routes/referralRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const profileRoutes = require('./routes/profileRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const labRoutes = require('./routes/labRoutes');
const labReferralRoutes = require('./routes/labReferralRoutes');
const labSettlementRoutes = require('./routes/labSettlementRoutes');
const labAdminRoutes = require('./routes/labAdminRoutes');
const exportRoutes = require('./routes/exportRoutes');

app.use('/v1/auth', authRoutes);
app.use('/v1/referrals', referralRoutes);
app.use('/v1/hospitals', hospitalRoutes);
// Laboratory module (mounted before /v1/admin so /v1/admin/labs resolves to the lab admin router)
app.use('/v1/admin/labs', labAdminRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/payments', paymentRoutes);
app.use('/v1/upload', uploadRoutes);
app.use('/v1/profile', profileRoutes);
app.use('/v1/settlements', settlementRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/v1/labs', labRoutes);
app.use('/v1/lab-referrals', labReferralRoutes);
app.use('/v1/lab-settlements', labSettlementRoutes);
app.use('/v1/exports', exportRoutes);

// Static uploads
app.use('/uploads', express.static('uploads'));

// Root Endpoint
app.get('/', (req, res) => {
  res.send('CareBridge API is running');
});

// Socket.io — role rooms for targeted events
io.on('connection', (socket) => {
  // Generic join: any authenticated user joins their personal + role rooms.
  // Powers in-app notifications and global real-time data refresh.
  socket.on('join', ({ token } = {}) => {
    try {
      if (!token || !process.env.JWT_SECRET) return;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.id) return;
      socket.join(`user:${decoded.id}`);
      if (decoded.role) socket.join(`role:${decoded.role}`);
    } catch (e) {
      console.warn('join:', e.message);
    }
  });

  socket.on('join_hospital', async ({ token } = {}) => {
    try {
      if (!token || !process.env.JWT_SECRET) return;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'hospital') return;
      const hospital = await Hospital.findOne({ userId: decoded.id });
      if (!hospital) return;
      socket.join(`hospital:${hospital._id.toString()}`);
    } catch (e) {
      console.warn('join_hospital:', e.message);
    }
  });

  socket.on('join_consultant', async ({ token } = {}) => {
    try {
      if (!token || !process.env.JWT_SECRET) return;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'consultant') return;
      const consultant = await Consultant.findOne({ userId: decoded.id });
      if (!consultant) return;
      socket.join(`consultant:${consultant._id.toString()}`);
    } catch (e) {
      console.warn('join_consultant:', e.message);
    }
  });

  socket.on('join_laboratory', async ({ token } = {}) => {
    try {
      if (!token || !process.env.JWT_SECRET) return;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'laboratory') return;
      const lab = await Laboratory.findOne({ userId: decoded.id });
      if (!lab) return;
      socket.join(`lab:${lab._id.toString()}`);
    } catch (e) {
      console.warn('join_laboratory:', e.message);
    }
  });

  socket.on('disconnect', () => { });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, { family: 4 })
  .then(async () => {
    console.log('MongoDB Connected');
    try {
      await ensurePlatformData();
      cron.schedule('* * * * *', () => {
        processReferralEscalations(io).catch((err) => console.error('referralEscalation', err));
      });
    } catch (err) {
      console.error('Startup initialization failed:', err);
      throw err;
    }
  })
  .catch((err) => console.error('MongoDB Connection Error:', err));

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
