#!/usr/bin/env python3
"""
PKL okuyucu - Sadece standard Python kütüphaneleri
"""
import pickle
import sys
import json
import math

def cosine_similarity(a, b):
    """Cosine similarity hesapla - numpy olmadan"""
    if len(a) != len(b):
        return 0.0
    
    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = math.sqrt(sum(x * x for x in a))
    magnitude_b = math.sqrt(sum(x * x for x in b))
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    
    return dot_product / (magnitude_a * magnitude_b)

def normalize_vector(vector):
    """Vector normalize et - numpy olmadan"""
    magnitude = math.sqrt(sum(x * x for x in vector))
    if magnitude == 0:
        return vector
    return [x / magnitude for x in vector]

def extract_embedding(face_data):
    """Face data'dan embedding çıkar"""
    if isinstance(face_data, dict):
        for key in ['embedding', 'normed_embedding', 'feat', 'face_embedding']:
            if key in face_data:
                emb = face_data[key]
                if isinstance(emb, list):
                    return emb
                # Diğer formatları da destekle
                return list(emb) if hasattr(emb, '__iter__') else None
    return None

def simple_pkl_matcher(pkl_path, user_embedding_str, threshold):
    """PKL matcher - standard Python ile"""
    try:
        # PKL dosyasını oku
        with open(pkl_path, 'rb') as f:
            data = pickle.load(f)
        
        # User embedding'i parse et
        user_embedding = json.loads(user_embedding_str) if isinstance(user_embedding_str, str) else user_embedding_str
        user_emb_normalized = normalize_vector(user_embedding)
        
        matches = []
        checked = 0
        
        print(f"PKL'den {len(data)} kayıt okundu", file=sys.stderr)
        print(f"User embedding boyutu: {len(user_embedding)}", file=sys.stderr)
        
        # Her kayıt için eşleştirme yap  
        for key, face_data in data.items():
            checked += 1
            
            # Embedding çıkar
            embedding = extract_embedding(face_data)
            
            if embedding and len(embedding) > 0:
                # Normalize et
                normalized_emb = normalize_vector(embedding)
                
                # Cosine similarity hesapla
                similarity = cosine_similarity(user_emb_normalized, normalized_emb)
                
                if similarity > threshold:
                    # Key format: "IMG_2072.JPG||face_3" veya direkt "IMG_2072.JPG"
                    image_name = key.split('||')[0] if '||' in key else key
                    
                    matches.append({
                        'face_id': key,
                        'similarity': round(similarity, 6),
                        'image_path': image_name,
                        'relative_path': f'denemelik/{image_name}'
                    })
                    
                    print(f"Eşleşme: {image_name} - similarity: {similarity:.3f}", file=sys.stderr)
        
        # Similarity'e göre sırala
        matches.sort(key=lambda x: x['similarity'], reverse=True)
        
        result = {
            'success': True,
            'matches': matches,
            'total_faces': checked,
            'threshold': threshold,
            'algorithm': 'Standard Python PKL Reader',
            'user_embedding_size': len(user_embedding)
        }
        
        print(json.dumps(result))
        return True
        
    except Exception as e:
        result = {
            'success': False,
            'error': str(e),
            'matches': []
        }
        print(json.dumps(result))
        return False

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 working_embedding_extractor.py <pkl_path> <user_embedding_json> <threshold>")
        sys.exit(1)
    
    pkl_path = sys.argv[1] 
    user_embedding = sys.argv[2]
    threshold = float(sys.argv[3])
    
    simple_pkl_matcher(pkl_path, user_embedding, threshold)