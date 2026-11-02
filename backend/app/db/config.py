from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from bson.errors import InvalidId
import os
import certifi
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend/.env is located reliably regardless of CWD
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/agentic_interviewer")
DB_NAME = os.getenv("MONGODB_DB", "agentic_interviewer")


class Database:
    client: AsyncIOMotorClient = None

    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        """
        Lazily creates the Mongo client. Motor connects on first operation, so this never blocks
        startup — important on Lambda where init time is limited and the client is reused across
        warm invocations.
        """
        if cls.client is None:
            kwargs = dict(
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
                socketTimeoutMS=20000,
                retryWrites=True,
            )
            if MONGODB_URI.startswith("mongodb+srv://") or "tls=true" in MONGODB_URI or "ssl=true" in MONGODB_URI:
                kwargs["tlsCAFile"] = certifi.where()
            cls.client = AsyncIOMotorClient(MONGODB_URI, **kwargs)
        return cls.client

    @classmethod
    async def ping(cls) -> bool:
        try:
            await cls.get_client().admin.command("ping")
            return True
        except Exception as e:
            print(f"[WARN] MongoDB ping failed: {e}")
            return False

    @classmethod
    async def close_db(cls):
        if cls.client:
            cls.client.close()
            cls.client = None

    @classmethod
    def get_database(cls):
        return cls.get_client()[DB_NAME]


def get_candidates_collection():
    return Database.get_database()["candidates"]


def get_interviews_collection():
    return Database.get_database()["interviews"]


def id_query(candidate_id: str) -> dict:
    """Mongo filter for a candidate id that may be an ObjectId or a plain string."""
    try:
        return {"_id": ObjectId(candidate_id)}
    except (InvalidId, TypeError):
        return {"_id": candidate_id}


async def find_candidate(candidate_id: str):
    if not candidate_id:
        return None
    return await get_candidates_collection().find_one(id_query(candidate_id))
