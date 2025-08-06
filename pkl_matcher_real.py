#!/usr/bin/env python3
"""
Gerçek PKL Face Matcher - InsightFace Buffalo_L uyumlu
PKL formatı: {"IMG_2072.JPG||face_3": {"embedding": [...], "path": "...", "bbox": [...], "kps": [...]}}
"""
import sys
import os
import json
import pickle
import math

def normalize_embedding(embedding):
    """Embedding'i L2 normalize et"""
    magnitude = math.sqrt(sum(x * x for x in embedding))
    if magnitude == 0:
        return embedding
    return [x / magnitude for x in embedding]

def cosine_similarity(emb1, emb2):
    """İki normalized embedding arasında cosine similarity (dot product)"""
    if len(emb1) != len(emb2):
        return 0.0
    return sum(a * b for a, b in zip(emb1, emb2))

def match_faces(pkl_path, user_embedding_json, threshold, model_path):
    """PKL veritabanından yüz eşleştirme yap"""
    try:
        # PKL dosyasını yükle
        print(f"🔍 PKL yükleniyor: {pkl_path}", file=sys.stderr)
        with open(pkl_path, 'rb') as f:
            face_database = pickle.load(f)
        
        print(f"✅ {len(face_database)} yüz kaydı yüklendi", file=sys.stderr)
        
        # User embedding'i parse et
        user_embedding = json.loads(user_embedding_json)
        user_emb_norm = normalize_embedding(user_embedding)
        
        print(f"📊 User embedding: {len(user_emb_norm)} boyut", file=sys.stderr)
        print(f"🎯 Threshold: {threshold}", file=sys.stderr)
        
        matches = []
        checked = 0
        
        # Her yüz kaydını kontrol et
        for key, face_data in face_database.items():
            checked += 1
            
            # Format: "IMG_2072.JPG||face_3"
            parts = key.split('||')
            image_name = parts[0] if parts else key
            face_id = parts[1] if len(parts) > 1 else 'face_0'
            
            # Embedding'i al
            if 'embedding' in face_data:
                db_embedding = face_data['embedding']
                
                # List veya numpy array'i list'e çevir
                if hasattr(db_embedding, 'tolist'):
                    db_embedding = db_embedding.tolist()
                elif not isinstance(db_embedding, list):
                    db_embedding = list(db_embedding)
                
                # Normalize et
                db_emb_norm = normalize_embedding(db_embedding)
                
                # Cosine similarity hesapla
                similarity = cosine_similarity(user_emb_norm, db_emb_norm)
                
                if similarity > threshold:
                    # Path bilgisini al
                    original_path = face_data.get('path', image_name)
                    
                    # Model klasörüne göre relative path
                    relative_path = os.path.relpath(original_path, os.path.dirname(pkl_path)) if os.path.isabs(original_path) else original_path
                    
                    # denemelik klasöründe ara
                    if not os.path.exists(os.path.join(model_path, relative_path)):
                        # denemelik altında dene
                        relative_path = os.path.join('denemelik', image_name)
                    
                    full_path = os.path.join(model_path, relative_path)
                    
                    matches.append({
                        'face_id': key,
                        'similarity': round(similarity, 6),
                        'image_name': image_name,
                        'face_index': face_id,
                        'relative_path': relative_path,
                        'full_path': full_path if os.path.exists(full_path) else None
                    })
                    
                    print(f"🎯 Eşleşme: {image_name} ({face_id}) - similarity: {similarity:.4f}", file=sys.stderr)
        
        # Similarity'e göre sırala
        matches.sort(key=lambda x: x['similarity'], reverse=True)
        
        print(f"✅ {checked} yüz kontrol edildi, {len(matches)} eşleşme bulundu", file=sys.stderr)
        
        # Sonucu JSON olarak döndür
        result = {
            'success': True,
            'matches': matches[:20],  # En fazla 20 eşleşme
            'total_checked': checked,
            'total_matches': len(matches),
            'threshold': threshold,
            'algorithm': 'Real PKL Matcher (InsightFace Buffalo_L)'
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        print(f"❌ Hata: {str(e)}", file=sys.stderr)
        print(f"Traceback: {traceback.format_exc()}", file=sys.stderr)
        
        result = {
            'success': False,
            'error': str(e),
            'matches': []
        }
        print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python3 pkl_matcher_real.py <pkl_path> <user_embedding_json> <threshold> <model_path>")
        sys.exit(1)
    
    pkl_path = sys.argv[1]
    user_embedding_json = sys.argv[2]
    threshold = float(sys.argv[3])
    model_path = sys.argv[4]
    
    match_faces(pkl_path, user_embedding_json, threshold, model_path)