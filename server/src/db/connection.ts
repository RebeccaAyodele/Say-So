import mongoose from 'mongoose';
import { config } from '../config.js';

let isConnected = false;

export async function connectToDatabase(uri?: string): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const targetUri = uri || config.MONGODB_URI;

  try {
    const conn = await mongoose.connect(targetUri, {
      dbName: config.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[Database] Connected to MongoDB Atlas (${config.MONGODB_DB_NAME})`);
    return conn;
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] Disconnected from MongoDB Atlas');
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
