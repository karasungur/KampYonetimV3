#!/usr/bin/env python3
"""
PKL içerik analizi - Embedding'lerin gerçekten farklı olup olmadığını kontrol et
"""
import sys
import os
import pickle
import torch
import numpy as np
import json

def analyze_pkl_database(pkl_path):
    """PKL veritabanındaki embedding'leri analiz et"""
    try:
        print(f"🔍 PKL analizi başlıyor: {pkl_path}")
        
        # PKL'i yükle
        try:
            data = torch.load(pkl_path, map_location='cpu')
        except:
            with open(pkl_path, 'rb') as f:
                data = pickle.load(f)
        
        print(f"✅ PKL yüklendi: {len(data)} kayıt")
        
        # İlk 5 kaydı detaylı analiz et
        embeddings = []
        keys = list(data.keys())[:5]
        
        for i, key in enumerate(keys):
            face_data = data[key]
            print(f"\n📝 Kayıt {i+1}: {key}")
            print(f"   Tip: {type(face_data)}")
            
            if isinstance(face_data, dict):
                print(f"   Dict keys: {list(face_data.keys())}")
                
                # Embedding'i bul
                embedding = None
                for embed_key in ['embedding', 'normed_embedding', 'feat', 'face_embedding']:
                    if embed_key in face_data:
                        embedding = face_data[embed_key]
                        print(f"   Embedding key: {embed_key}")
                        break
                
                if embedding is None:
                    # İlk array/list'i al
                    for k, v in face_data.items():
                        if isinstance(v, (np.ndarray, torch.Tensor, list)):
                            embedding = v
                            print(f"   Embedding key (fallback): {k}")
                            break
                
                if embedding is not None:
                    if isinstance(embedding, torch.Tensor):
                        embedding = embedding.cpu().numpy()
                    elif isinstance(embedding, list):
                        embedding = np.array(embedding)
                    
                    embedding = embedding.flatten()
                    embeddings.append(embedding)
                    
                    print(f"   Embedding boyut: {embedding.shape}")
                    print(f"   İlk 5 değer: {embedding[:5]}")
                    print(f"   Son 5 değer: {embedding[-5:]}")
                    print(f"   Ortalama: {np.mean(embedding):.6f}")
                    print(f"   Std Dev: {np.std(embedding):.6f}")
                    print(f"   Min-Max: {np.min(embedding):.6f} - {np.max(embedding):.6f}")
                    
                    # L2 norm
                    norm = np.linalg.norm(embedding)
                    print(f"   L2 Norm: {norm:.6f}")
                else:
                    print("   ❌ Embedding bulunamadı!")
            else:
                print(f"   Raw data tip: {type(face_data)}")
        
        # Embedding'leri karşılaştır
        if len(embeddings) >= 2:
            print(f"\n🔍 Embedding karşılaştırması:")
            for i in range(len(embeddings)-1):
                for j in range(i+1, len(embeddings)):
                    # Normalize et
                    emb1 = embeddings[i] / np.linalg.norm(embeddings[i])
                    emb2 = embeddings[j] / np.linalg.norm(embeddings[j])
                    
                    # Cosine similarity
                    similarity = np.dot(emb1, emb2)
                    
                    print(f"   Embedding {i+1} vs {j+1}: {similarity:.6f}")
                    
                    # Eğer hepsi aynıysa büyük problem
                    if abs(similarity - 1.0) < 0.001:
                        print(f"   ⚠️ Embedding {i+1} ve {j+1} neredeyse AYNI!")
        
        return True
        
    except Exception as e:
        print(f"❌ PKL analiz hatası: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python debug_pkl_content.py <pkl_path>")
        sys.exit(1)
    
    pkl_path = sys.argv[1]
    analyze_pkl_database(pkl_path)