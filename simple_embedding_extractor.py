#!/usr/bin/env python3
"""
Basit PKL okuyucu - Torch olmadan çalışır
"""
import pickle
import sys
import json
import numpy as np

def simple_pkl_reader(pkl_path, user_embedding, threshold):
    """PKL'i torch olmadan okur ve eşleştirme yapar"""
    try:
        print(f"🔍 PKL okuma başlıyor: {pkl_path}", file=sys.stderr)
        
        # PKL dosyasını oku
        with open(pkl_path, 'rb') as f:
            data = pickle.load(f)
        
        print(f"✅ PKL yüklendi: {len(data)} kayıt", file=sys.stderr)
        
        # User embedding'i numpy array'e çevir
        if isinstance(user_embedding, str):
            user_embedding = json.loads(user_embedding)
        
        user_emb = np.array(user_embedding, dtype=np.float32)
        user_emb = user_emb / np.linalg.norm(user_emb)  # Normalize
        
        print(f"📊 User embedding: boyut={len(user_emb)}, norm={np.linalg.norm(user_emb):.3f}", file=sys.stderr)
        
        matches = []
        checked = 0
        
        # Her kayıt için eşleştirme yap
        for key, face_data in data.items():
            checked += 1
            
            # Embedding'i bul
            embedding = None
            if isinstance(face_data, dict):
                for emb_key in ['embedding', 'normed_embedding', 'feat']:
                    if emb_key in face_data:
                        embedding = face_data[emb_key]
                        break
            
            if embedding is not None:
                # Numpy array'e çevir
                if isinstance(embedding, list):
                    embedding = np.array(embedding, dtype=np.float32)
                
                embedding = embedding.flatten()
                
                # Normalize et
                if np.linalg.norm(embedding) > 0:
                    embedding = embedding / np.linalg.norm(embedding)
                    
                    # Cosine similarity hesapla
                    similarity = float(np.dot(user_emb, embedding))
                    
                    if similarity > threshold:
                        # Key'den image path çıkar (yeni format: "IMG_2072.JPG||face_3")
                        image_name = key.split('||')[0] if '||' in key else key
                        
                        matches.append({
                            'face_id': key,
                            'similarity': similarity,
                            'image_path': image_name,
                            'relative_path': f'denemelik/{image_name}'
                        })
                        
                        print(f"🎯 Eşleşme: {image_name} - {similarity:.3f}", file=sys.stderr)
        
        # Similarity'e göre sırala
        matches.sort(key=lambda x: x['similarity'], reverse=True)
        
        print(f"✅ {checked} kayıt kontrol edildi, {len(matches)} eşleşme bulundu", file=sys.stderr)
        
        # JSON çıktı ver
        result = {
            'success': True,
            'matches': matches,
            'total_faces': checked,
            'threshold': threshold,
            'algorithm': 'Simple PKL Reader (No Torch)',
            'user_embedding_norm': float(np.linalg.norm(user_emb))
        }
        
        print(json.dumps(result))
        return True
        
    except Exception as e:
        print(f"❌ Hata: {e}", file=sys.stderr)
        result = {
            'success': False,
            'error': str(e),
            'matches': []
        }
        print(json.dumps(result))
        return False

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 simple_embedding_extractor.py <pkl_path> <user_embedding_json> <threshold>")
        sys.exit(1)
    
    pkl_path = sys.argv[1] 
    user_embedding = sys.argv[2]
    threshold = float(sys.argv[3])
    
    simple_pkl_reader(pkl_path, user_embedding, threshold)