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

def find_matching_faces(user_embedding, face_db, threshold=0.6):
    """Kullanıcı embedding'i ile veritabanındaki yüzleri eşleştir"""
    matches = []
    
    # User embedding'ini numpy array'e çevir
    user_emb = np.array(user_embedding, dtype=np.float32)
    
    for face_id, face_data in face_db.items():
        try:
            # Face database'indeki embedding'i al
            db_embedding = np.array(face_data['embedding'], dtype=np.float32)
            
            # Manuel cosine similarity hesapla
            similarity = cosine_similarity_manual(user_emb, db_embedding)
            
            if similarity > threshold:
                matches.append({
                    'face_id': face_id,
                    'similarity': float(similarity),
                    'image_path': face_data.get('image_path', ''),
                    'metadata': face_data.get('metadata', {})
                })
                print(f"🎯 Match found: {face_id} (similarity: {similarity:.3f})")
        except Exception as e:
            print(f"⚠️ Error processing face {face_id}: {e}")
            continue
    
    # Similarity'ye göre sırala
    matches.sort(key=lambda x: x['similarity'], reverse=True)
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
            
            # Eğer tam yol yoksa, denemelik klasörde ara
            if not os.path.exists(source_photo):
                # Denemelik klasöründe ara
                denemelik_path = os.path.join(model_path, 'denemelik', os.path.basename(image_path))
                if os.path.exists(denemelik_path):
                    source_photo = denemelik_path
                else:
                    # Model dizininde tüm fotoğrafları ara
                    photo_patterns = [
                        os.path.join(model_path, '**', os.path.basename(image_path)),
                        os.path.join(model_path, '**', f"*{os.path.basename(image_path)}*")
                    ]
                    found = False
                    for pattern in photo_patterns:
                        found_files = glob.glob(pattern, recursive=True)
                        if found_files:
                            source_photo = found_files[0]
                            found = True
                            break
                    if not found:
                        print(f"⚠️ Fotoğraf bulunamadı: {image_path}")
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