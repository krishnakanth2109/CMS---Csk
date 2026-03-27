import { MongoClient } from 'mongodb';

// Agreement module uses its own MongoDB connection (native driver)
// This connects to the same database but uses the 'AutoOfferLetterDB' database
const MONGO_URL = process.env.AGREEMENT_MONGO_URL || process.env.MONGO_URL || '';

let client;
let db;

export async function connectAgreementDB() {
    if (db) return db;
    
    if (!MONGO_URL) {
        console.warn('⚠️  No MongoDB URL found for Agreement DB (AGREEMENT_MONGO_URL / MONGO_URL)');
        return null;
    }

    try {
        client = new MongoClient(MONGO_URL, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            tls: true,
        });
        await client.connect();
        db = client.db('AutoOfferLetterDB');
        console.log('✅ Agreement DB connected (AutoOfferLetterDB)');
        return db;
    } catch (err) {
        console.error('❌ Agreement DB connection error:', err.message);
        throw err;
    }
}

export function getAgreementDB() {
    if (!db) {
        throw new Error('Agreement Database not initialized. Call connectAgreementDB() first.');
    }
    return db;
}
