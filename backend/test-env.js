require('dotenv').config();
console.log('Port:', process.env.PORT);
console.log('MongoDB URI:', process.env.MONGODB_URI);
console.log('JWT Secret:', process.env.JWT_SECRET ? 'Loaded ✅' : 'Missing ❌');