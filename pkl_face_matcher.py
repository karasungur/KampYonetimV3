#!/usr/bin/env python3
"""
PKL Face Database Reader and Matcher
Gerçek PKL dosyasından yüz embeddinglerini okur ve eşleştirme yapar
"""
import sys
import os
import json
import pickle
import torch
import numpy as np
from typing import Dict, List, Tuple, Any

def load_pkl_database(pkl_path: str) -> Dict[str, Any]:
    """PKL veritabanını yükle"""
    try:
        # Önce torch.load dene
        try:
            print(f"🔄 torch.load ile yükleniyor: {pkl_path}", file=sys.stderr)
            data = torch.load(pkl_path, map_location='cpu')
            print(f"✅ torch.load başarılı. Tip: {type(data)}", file=sys.stderr)
            return data
        except Exception as torch_error:
            print(f"⚠️ torch.load başarısız ({torch_error}), pickle.load ile devam ediliyor...", file=sys.stderr)
            
        # Fallback: pickle.load
        with open(pkl_path, 'rb') as f:
            data = pickle.load(f)
            print(f"✅ pickle.load ile yüklendi. Tip: {type(data)}", file=sys.stderr)
            return data
            
    except Exception as e:
        print(f"❌ PKL yükleme hatası: {e}", file=sys.stderr)
        return None

def extract_embedding_from_face_data(face_data: Any) -> np.ndarray:
    """Yüz verisi dict'inden embedding çıkar"""
    try:
        if isinstance(face_data, dict):
            # InsightFace formatı
            if 'embedding' in face_data:
                embedding = face_data['embedding']
            elif 'normed_embedding' in face_data:
                embedding = face_data['normed_embedding']
            elif 'feat' in face_data:
                embedding = face_data['feat']
            else:
                # İlk numpy array'i bul
                for key, value in face_data.items():
                    if isinstance(value, (np.ndarray, torch.Tensor, list)):
                        if isinstance(value, torch.Tensor):
                            embedding = value.cpu().numpy()
                        elif isinstance(value, list):
                            embedding = np.array(value)
                        else:
                            embedding = value
                        break
                else:
                    print(f"⚠️ Embedding bulunamadı, keys: {list(face_data.keys())}", file=sys.stderr)
                    return None
                    
        elif isinstance(face_data, (np.ndarray, torch.Tensor)):
            if isinstance(face_data, torch.Tensor):
                embedding = face_data.cpu().numpy()
            else:
                embedding = face_data
        else:
            print(f"⚠️ Bilinmeyen yüz verisi tipi: {type(face_data)}", file=sys.stderr)
            return None
        
        # NumPy array'e çevir
        if not isinstance(embedding, np.ndarray):
            embedding = np.array(embedding)
            
        # Tek boyutlu yap
        embedding = embedding.flatten()
        
        # L2 normalize et (InsightFace standardı)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
            
        print(f"✅ Embedding çıkarıldı: {embedding.shape} boyut, norm={norm:.3f}", file=sys.stderr)
        return embedding
        
    except Exception as e:
        print(f"❌ Embedding çıkarma hatası: {e}", file=sys.stderr)
        return None

def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """Cosine similarity hesapla (normalize edilmiş embeddingler için dot product)"""
    try:
        if emb1.shape != emb2.shape:
            print(f"⚠️ Embedding boyutları uyuşmuyor: {emb1.shape} vs {emb2.shape}", file=sys.stderr)
            return 0.0
        
        # Normalize edilmiş embeddingler için dot product = cosine similarity
        similarity = np.dot(emb1, emb2)
        return float(similarity)
        
    except Exception as e:
        print(f"❌ Similarity hesaplama hatası: {e}", file=sys.stderr)
        return 0.0

def match_faces(user_embedding: List[float], pkl_path: str, threshold: float = 0.5, model_path: str = None) -> Dict:
    """PKL veritabanında yüz eşleştirmesi yap"""
    try:
        print(f"🦬 PKL yüz eşleştirmesi başlıyor...", file=sys.stderr)
        print(f"📁 PKL dosyası: {pkl_path}", file=sys.stderr)
        print(f"🎯 Threshold: {threshold}", file=sys.stderr)
        
        # PKL veritabanını yükle
        pkl_data = load_pkl_database(pkl_path)
        if not pkl_data:
            return {"success": False, "error": "PKL dosyası yüklenemedi"}
        
        print(f"📊 PKL veritabanı yüklendi: {len(pkl_data)} kayıt", file=sys.stderr)
        
        # User embedding'i NumPy array'e çevir
        user_emb = np.array(user_embedding)
        if user_emb.ndim > 1:
            user_emb = user_emb.flatten()
        
        # User embedding'i normalize et
        user_norm = np.linalg.norm(user_emb)
        if user_norm > 0:
            user_emb = user_emb / user_norm
            
        print(f"👤 User embedding: {user_emb.shape} boyut", file=sys.stderr)
        
        # Her PKL kaydı ile karşılaştır
        matches = []
        checked_faces = 0
        
        for face_key, face_data in pkl_data.items():
            checked_faces += 1
            
            # Face embedding'i çıkar
            face_embedding = extract_embedding_from_face_data(face_data)
            if face_embedding is None:
                continue
                
            # Similarity hesapla
            similarity = cosine_similarity(user_emb, face_embedding)
            
            if similarity > threshold:
                # Dosya yolunu temizle ve models klasörüne map et
                image_path = face_key.split('||')[0] if '||' in face_key else face_key
                image_name = os.path.basename(image_path).replace('\\', '/')
                
                # Windows path'inden klasör yapısını çıkar
                # D:/Users/.../denemelik\IMG_0909.JPG -> denemelik/IMG_0909.JPG
                windows_parts = image_path.replace('\\', '/').split('/')
                relative_path = image_name  # Default: sadece dosya adı
                
                # denemelik, kişi_adı gibi klasörleri bul
                for i, part in enumerate(windows_parts):
                    if part in ['denemelik'] or (part != '' and not ':' in part and len(part) < 50):
                        # Son 2 parçayı al (klasör/dosya.jpg)
                        if i < len(windows_parts) - 1:
                            relative_path = f"{part}/{windows_parts[-1]}"
                            break
                
                # Model path'i varsa tam yolu oluştur
                full_model_path = None
                if model_path:
                    potential_paths = [
                        os.path.join(model_path, image_name),
                        os.path.join(model_path, 'denemelik', image_name),
                        os.path.join(model_path, relative_path),
                    ]
                    # İlk bulunan dosyayı kullan
                    for potential_path in potential_paths:
                        if os.path.exists(potential_path):
                            full_model_path = potential_path
                            relative_path = os.path.relpath(potential_path, model_path)
                            break
                
                matches.append({
                    "face_id": face_key,
                    "similarity": similarity,
                    "image_path": image_name,
                    "relative_path": relative_path,
                    "full_path": full_model_path,
                    "original_path": image_path,
                    "metadata": {
                        "type": "pkl_real_match", 
                        "threshold": threshold,
                        "embedding_dim": face_embedding.shape[0],
                        "path_mapped": full_model_path is not None
                    }
                })
        
        # Similarity'ye göre sırala (yüksekten düşüğe)
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        
        print(f"📊 Sonuçlar:", file=sys.stderr)
        print(f"- Kontrol edilen yüz: {checked_faces}", file=sys.stderr) 
        print(f"- Threshold ({threshold}) üzeri eşleşme: {len(matches)}", file=sys.stderr)
        if matches:
            print(f"- En yüksek similarity: {matches[0]['similarity']:.3f}", file=sys.stderr)
            print(f"- En düşük similarity: {matches[-1]['similarity']:.3f}", file=sys.stderr)
        
        # Debug: Top 5 similarity
        if checked_faces > 0:
            print(f"🔍 İlk 5 yüz similarity değerleri:", file=sys.stderr)
            temp_similarities = []
            for face_key, face_data in list(pkl_data.items())[:5]:
                face_embedding = extract_embedding_from_face_data(face_data)
                if face_embedding is not None:
                    similarity = cosine_similarity(user_emb, face_embedding)
                    image_name = os.path.basename(face_key.split('||')[0])
                    temp_similarities.append((image_name, similarity))
            
            temp_similarities.sort(key=lambda x: x[1], reverse=True)
            for i, (name, sim) in enumerate(temp_similarities):
                print(f"  {i+1}. {name}: {sim:.3f}", file=sys.stderr)
        
        return {
            "success": True,
            "matches": matches,
            "total_faces": checked_faces,
            "threshold": threshold,
            "algorithm": "Real PKL InsightFace Matching"
        }
        
    except Exception as e:
        print(f"❌ PKL eşleştirme hatası: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

def main():
    if len(sys.argv) not in [4, 5]:
        print(json.dumps({"success": False, "error": "Usage: python3 pkl_face_matcher.py <pkl_path> <user_embedding_json> <threshold> [model_path]"}))
        sys.exit(1)
    
    pkl_path = sys.argv[1]
    user_embedding_json = sys.argv[2]
    threshold = float(sys.argv[3])
    model_path = sys.argv[4] if len(sys.argv) > 4 else None
    
    if not os.path.exists(pkl_path):
        print(json.dumps({"success": False, "error": f"PKL dosyası bulunamadı: {pkl_path}"}))
        sys.exit(1)
    
    try:
        # User embedding'i parse et
        user_embedding = json.loads(user_embedding_json)
        
        print(f"🦬 PKL Face Matcher başlıyor...", file=sys.stderr)
        print(f"📁 PKL: {pkl_path}", file=sys.stderr) 
        print(f"👤 User embedding: {len(user_embedding)} boyut", file=sys.stderr)
        print(f"🎯 Threshold: {threshold}", file=sys.stderr)
        
        # Eşleştirme yap
        result = match_faces(user_embedding, pkl_path, threshold, model_path)
        
        # JSON olarak stdout'a yazdır
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Parsing hatası: {e}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()