
import os
import torch
from sentence_transformers import SentenceTransformer
from transformers import pipeline

print("Preloading models for faster startup...")

# Preload embedding model
try:
    print("Loading SentenceTransformer...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("SentenceTransformer loaded.")
except Exception as e:
    print(f"Error loading SentenceTransformer: {e}")

# Preload other models if any (e.g., emotion detection)
# Add other model loading code here if needed

print("Model preloading complete.")
