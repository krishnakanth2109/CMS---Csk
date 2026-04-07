import mongoose from 'mongoose';
import 'dotenv/config';

async function check() {
  try {
    console.log("Connecting to:", process.env.MONGO_URL);
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected!");
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    
    const candidates = await db.collection('candidates').find({}).limit(5).toArray();
    console.log("Candidates found:", candidates.length);
    
    const users = await db.collection('users').find({}).limit(5).toArray();
    console.log("Users found:", users.length);
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

check();
