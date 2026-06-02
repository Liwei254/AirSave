import mongoose from 'mongoose';
import { isPostgresDataStoreEnabled } from './dataStore.js';

const connectDB = async () => {
  if (isPostgresDataStoreEnabled()) {
    console.log('PostgreSQL datastore enabled; skipping MongoDB connection.');
    return null;
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
