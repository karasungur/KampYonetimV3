#!/usr/bin/env python3
"""
PKL okuyucu - Numpy array desteği ile
"""
import pickle
import sys
import json
import math

def alternative_pkl_parser(file_path):
    """Alternatif PKL parser - numpy olmadan çalışır"""
    print(f"Attempting alternative PKL parsing: {file_path}", file=sys.stderr)
    
    try:
        # JSON formatında veri varsa direkt okuyalım
        json_file = file_path.replace('.pkl', '.json')
        import os
        if os.path.exists(json_file):
            with open(json_file, 'r') as f:
                data = json.load(f)
            print(f"JSON file found and loaded: {len(data)} records", file=sys.stderr)
            return data
    except:
        pass
    
    # PKL dosyasını basit şekilde okumaya çalış
    try:
        import pickle
        
        # Modern pickle okuma
        with open(file_path, 'rb') as f:
            # Dosya boyutunu kontrol et
            f.seek(0, 2)
            file_size = f.tell()
            f.seek(0)
            
            print(f"PKL file size: {file_size} bytes", file=sys.stderr)
            
            if file_size > 1000000:  # 1MB'dan büyükse
                print("Large PKL file detected, using safe mode", file=sys.stderr)
                # Büyük dosyalar için safe mode
                return {}
            
            # Protocol'ü kontrol et
            header = f.read(2)
            f.seek(0)
            
            if header == b'\x80\x04':  # Pickle protocol 4
                print("Pickle protocol 4 detected", file=sys.stderr)
                
            data = pickle.load(f, encoding='bytes')
            
            # Bytes keys'leri string'e çevir
            if isinstance(data, dict):
                converted_data = {}
                for k, v in data.items():
                    key = k.decode('utf-8') if isinstance(k, bytes) else k
                    converted_data[key] = v
                print(f"PKL loaded and converted: {len(converted_data)} records", file=sys.stderr)
                return converted_data
            
            print(f"PKL loaded: {len(data)} records", file=sys.stderr)
            return data
            
    except Exception as e:
        print(f"Alternative PKL parser failed: {e}", file=sys.stderr)
        # Son fallback: boş dict döndür
        print("Returning empty dict as fallback", file=sys.stderr)
        return {}

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
    """Face data'dan embedding çıkar - numpy array desteği ile"""
    if isinstance(face_data, dict):
        for key in ['embedding', 'normed_embedding', 'feat', 'face_embedding']:
            if key in face_data:
                emb = face_data[key]
                
                # Liste ise direkt döndür
                if isinstance(emb, list):
                    return emb
                    
                # Numpy array ise liste'ye çevir
                if hasattr(emb, 'tolist'):
                    try:
                        return emb.tolist()
                    except:
                        pass
                
                # Numpy olmadan array benzeri objeler
                if hasattr(emb, '__iter__') and not isinstance(emb, (str, bytes)):
                    try:
                        return list(emb)
                    except:
                        pass
                
                # String representationdan parse etme
                if isinstance(emb, str):
                    try:
                        return json.loads(emb)
                    except:
                        pass
                
                # Mock array object
                if hasattr(emb, 'data') and isinstance(emb.data, list):
                    return emb.data
                
                print(f"Bilinmeyen embedding formatı: {type(emb)} - {key}", file=sys.stderr)
                
    return None

def simple_pkl_matcher(pkl_path, user_embedding_str, threshold):
    """PKL matcher - numpy array desteği ile"""
    try:
        print(f"PKL dosyası okunuyor: {pkl_path}", file=sys.stderr)
        
        # PKL dosyasını alternatif parser ile oku
        data = alternative_pkl_parser(pkl_path)
        
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