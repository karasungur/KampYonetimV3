#!/usr/bin/env python3
"""
Embedding sorunu debug - Torch/pickle olmadan basit analiz
"""
import sys
import os
import pickle
import json
import numpy as np

def debug_pkl_simple(pkl_path):
    """Basit PKL debug - torch olmadan"""
    try:
        print(f"🔍 PKL Debug: {pkl_path}")
        
        # Pickle ile yükle
        with open(pkl_path, 'rb') as f:
            data = pickle.load(f)
        
        print(f"✅ Yüklendi: {len(data)} kayıt")
        print(f"📋 Tip: {type(data)}")
        
        # İlk 3 kaydı analiz et
        keys = list(data.keys())[:3]
        embeddings = []
        
        for i, key in enumerate(keys):
            print(f"\n📝 Kayıt {i+1}: {key}")
            face_data = data[key]
            print(f"   Face data tip: {type(face_data)}")
            
            if isinstance(face_data, dict):
                print(f"   Dict keys: {list(face_data.keys())}")
                
                # Embedding bul
                embedding = None
                for embed_key in ['embedding', 'normed_embedding', 'feat']:
                    if embed_key in face_data:
                        embedding = face_data[embed_key]
                        print(f"   Embedding key: {embed_key}")
                        break
                
                if embedding is not None:
                    if isinstance(embedding, list):
                        embedding = np.array(embedding)
                    
                    embedding = embedding.flatten()
                    embeddings.append(embedding)
                    
                    print(f"   Boyut: {embedding.shape}")
                    print(f"   İlk 5: {embedding[:5]}")
                    print(f"   Ortalama: {np.mean(embedding):.6f}")
                    print(f"   L2 Norm: {np.linalg.norm(embedding):.6f}")
        
        # Embedding karşılaştırması
        if len(embeddings) >= 2:
            print(f"\n🔍 Embedding Karşılaştırması:")
            for i in range(len(embeddings)):
                for j in range(i+1, len(embeddings)):
                    # Normalize
                    emb1 = embeddings[i] / np.linalg.norm(embeddings[i])
                    emb2 = embeddings[j] / np.linalg.norm(embeddings[j])
                    
                    # Cosine similarity
                    similarity = np.dot(emb1, emb2)
                    print(f"   Embedding {i+1} vs {j+1}: {similarity:.6f}")
                    
                    # AYNI embedding kontrolü
                    if abs(similarity - 1.0) < 0.001:
                        print(f"   ⚠️⚠️⚠️ BU EMBEDDİNGLER AYNI! ⚠️⚠️⚠️")
                        print("   PKL'deki embedding'ler özdeş - bu probleminizin kaynağı!")
        
        # Rastgele user embedding test
        print(f"\n🧪 Rastgele user embedding testi:")
        fake_user_emb = np.random.rand(512)  # 512 boyutlu rastgele
        fake_user_emb = fake_user_emb / np.linalg.norm(fake_user_emb)
        
        print(f"   Fake user embedding L2 norm: {np.linalg.norm(fake_user_emb):.6f}")
        
        # İlk PKL embedding'i ile karşılaştır
        if embeddings:
            pkl_emb = embeddings[0] / np.linalg.norm(embeddings[0])
            similarity = np.dot(fake_user_emb, pkl_emb)
            print(f"   Fake user vs PKL embedding 1: {similarity:.6f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Debug hatası: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python debug_embedding_issue.py <pkl_path>")
        sys.exit(1)
    
    debug_pkl_simple(sys.argv[1])