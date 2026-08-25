const auth = require('./src/middleware/auth');
console.log('Auth middleware:', auth);
const referralRoutes = require('./src/routes/referralRoutes');
console.log('Referral routes loaded');
process.exit(0);
