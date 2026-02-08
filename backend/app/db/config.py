from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/agentic_interviewer")

class Database:
    client: AsyncIOMotorClient = None
    
    @classmethod
    async def connect_db(cls):
        """Connect to MongoDB"""
        try:
            cls.client = AsyncIOMotorClient(MONGODB_URI)
            # Test connection
            await cls.client.admin.command('ping')
            print(f"✅ Connected to MongoDB: {MONGODB_URI}")
        except ConnectionFailure as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            raise
    
    @classmethod
    async def close_db(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            print("📴 MongoDB connection closed")
    
    @classmethod
    def get_database(cls):
        """Get database instance"""
        if not cls.client:
            raise Exception("Database not connected. Call connect_db() first.")
        return cls.client.get_database()

# Get collections
def get_candidates_collection():
    db = Database.get_database()
    return db["candidates"]

def get_interviews_collection():
    db = Database.get_database()
    return db["interviews"]
