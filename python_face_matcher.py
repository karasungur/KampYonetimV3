#!/usr/bin/env python3
"""
Gerçek yüz eşleştirme için Python face matcher
PKL dosyasından face database'ini okur ve cosine similarity hesaplar
"""

import sys
import os
import json
import pickle
import numpy as np
import glob
import shutil

def load_face_database(pkl_path):
    """PKL dosyasından face database'ini yükle"""
    try:
        with open(pkl_path, 'rb') as f:
            face_db = pickle.load(f)
        print(f"✅ Face database loaded: {len(face_db)} entries")
        return face_db
    except Exception as e:
        print(f"❌ PKL dosyası yüklenemedi: {e}")
        return None

def cosine_similarity_manual(vec1, vec2):
    """Manuel cosine similarity hesaplama"""
    dot_product = np.dot(vec1, vec2)
    norm_vec1 = np.linalg.norm(vec1)
    norm_vec2 = np.linalg.norm(vec2)
    
    if norm_vec1 == 0 or norm_vec2 == 0:
        return 0.0
    
    return dot_product / (norm_vec1 * norm_vec2)

def extract_embedding_from_dict(face_data):
    """Yeni PKL format dict'inden embedding çıkar"""
    try:
        if isinstance(face_data, dict):
            # Yaygın embedding key'leri
            for key in ['embedding', 'normed_embedding', 'feat', 'face_embedding']:
                if key in face_data:
                    return np.array(face_data[key], dtype=np.float32)
            
            # Herhangi bir array/list ara
            for key, value in face_data.items():
                if isinstance(value, (list, np.ndarray)) and len(value) > 100:
                    return np.array(value, dtype=np.float32)
        
        return np.array(face_data, dtype=np.float32) if not isinstance(face_data, dict) else None
    except Exception as e:
        print(f"⚠️ Embedding çıkarma hatası: {e}")
        return None

def parse_face_key_python(face_key):
    """Yeni PKL formatını parse et: IMG_2072.JPG||face_3"""
    if '||' in face_key:
        filename, face_part = face_key.split('||', 1)
        face_num = face_part.replace('face_', '')
        return filename, face_num
    return face_key, '0'

def find_matching_faces(user_embedding, face_db, threshold=0.5):
    """Yeni PKL formatı ile yüz eşleştirme (0.5 threshold user isteği)"""
    matches = []
    
    print(f"🦬 Python face matcher: {len(face_db)} yüz, threshold: {threshold}")
    
    # User embedding'ini numpy array'e çevir ve normalize et
    user_emb = np.array(user_embedding, dtype=np.float32)
    user_emb = user_emb / np.linalg.norm(user_emb)  # L2 normalize
    
    processed_faces = 0
    
    for face_key, face_data in face_db.items():
        processed_faces += 1
        
        try:
            # Yeni format için embedding çıkar
            db_embedding = extract_embedding_from_dict(face_data)
            if db_embedding is None:
                continue
            
            # Normalize et
            db_embedding = db_embedding / np.linalg.norm(db_embedding)
            
            # Cosine similarity hesapla
            similarity = cosine_similarity_manual(user_emb, db_embedding)
            
            if similarity > threshold:
                # Yeni formatı parse et
                image_filename, face_number = parse_face_key_python(face_key)
                
                matches.append({
                    'face_key': face_key,
                    'similarity': float(similarity),
                    'image_filename': image_filename,
                    'face_number': face_number,
                    'image_path': image_filename,  # Backward compatibility
                    'metadata': {
                        'format': 'new_pkl_format',
                        'embedding_dim': len(db_embedding)
                    }
                })
                print(f"🎯 MATCH: {image_filename} (face_{face_number}) -> {similarity:.3f}")
                
        except Exception as e:
            print(f"⚠️ Error processing face {face_key}: {e}")
            continue
    
    # Similarity'ye göre sırala
    matches.sort(key=lambda x: x['similarity'], reverse=True)
    print(f"✅ {processed_faces} yüz işlendi, {len(matches)} match bulundu")
    return matches

def copy_matched_photos(matches, model_path, output_dir):
    """Eşleşen fotoğrafları output dizinine kopyala"""
    copied_files = []
    
    # Output dizinini oluştur
    os.makedirs(output_dir, exist_ok=True)
    
    for i, match in enumerate(matches):
        try:
            # Fotoğraf dosyasını bul
            image_path = match.get('image_path', '')
            if not image_path:
                continue
                
            # Model dizinindeki fotoğraf yolunu oluştur
            source_photo = os.path.join(model_path, image_path)
            
            # Yeni PKL format için dosya arama - relative path zaten kullanıyor
            if not os.path.exists(source_photo):
                # Direkt models klasöründe ara (yeni format: models/model_adı/IMG.jpg)
                alt_paths = [
                    os.path.join(model_path, os.path.basename(image_path)),
                    os.path.join(model_path, 'denemelik', os.path.basename(image_path)),
                    # Recursive search
                    *glob.glob(os.path.join(model_path, '**', os.path.basename(image_path)), recursive=True)
                ]
                
                found = False
                for alt_path in alt_paths:
                    if os.path.exists(alt_path):
                        source_photo = alt_path
                        found = True
                        break
                
                if not found:
                    print(f"⚠️ Fotoğraf bulunamadı: {image_path} (modelin: {model_path})")
                    continue
            
            if os.path.exists(source_photo):
                # Hedef dosya adı oluştur
                similarity_str = f"{match['similarity']:.3f}".replace('.', '_')
                filename = f"match_{i+1:02d}_sim_{similarity_str}_{os.path.basename(source_photo)}"
                dest_photo = os.path.join(output_dir, filename)
                
                # Fotoğrafı kopyala
                shutil.copy2(source_photo, dest_photo)
                copied_files.append({
                    'original': source_photo,
                    'copied': dest_photo,
                    'similarity': match['similarity']
                })
                print(f"📸 Fotoğraf kopyalandı: {filename}")
            
        except Exception as e:
            print(f"❌ Fotoğraf kopyalama hatası: {e}")
            continue
    
    return copied_files

def main():
    if len(sys.argv) != 5:
        print("Kullanım: python face_matcher.py <model_path> <user_embedding_json> <output_dir> <threshold>")
        sys.exit(1)
    
    model_path = sys.argv[1]
    user_embedding_json = sys.argv[2]
    output_dir = sys.argv[3]
    threshold = float(sys.argv[4])
    
    print(f"🔍 Face matching başlıyor...")
    print(f"📂 Model path: {model_path}")
    print(f"📊 Threshold: {threshold}")
    
    # PKL dosyasını yükle
    pkl_path = os.path.join(model_path, 'face_database.pkl')
    if not os.path.exists(pkl_path):
        print(f"❌ PKL dosyası bulunamadı: {pkl_path}")
        sys.exit(1)
    
    face_db = load_face_database(pkl_path)
    if face_db is None:
        sys.exit(1)
    
    # User embedding'ini yükle
    try:
        user_embedding = json.loads(user_embedding_json)
        print(f"✅ User embedding loaded: {len(user_embedding)} dimensions")
    except Exception as e:
        print(f"❌ User embedding parse hatası: {e}")
        sys.exit(1)
    
    # Yüz eşleştirmesi yap
    matches = find_matching_faces(user_embedding, face_db, threshold)
    
    if not matches:
        print("❌ Hiç eşleşme bulunamadı")
        # Boş sonuç dosyası oluştur
        result = {
            'matches': [],
            'total_matches': 0,
            'copied_files': []
        }
    else:
        print(f"✅ {len(matches)} eşleşme bulundu")
        
        # Eşleşen fotoğrafları kopyala
        copied_files = copy_matched_photos(matches, model_path, output_dir)
        
        result = {
            'matches': matches,
            'total_matches': len(matches),
            'copied_files': copied_files
        }
    
    # Sonuçları JSON olarak yazdır
    print("🎯 RESULT_JSON:", json.dumps(result))
    
    return 0

if __name__ == "__main__":
    sys.exit(main())