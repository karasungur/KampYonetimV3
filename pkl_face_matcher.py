#!/usr/bin/env python3
"""
PKL Face Database Reader and Matcher - Yeni Format Destekli
Gerçek PKL dosyasından yüz embeddinglerini okur ve eşleştirme yapar
Yeni format: "IMG_2072.JPG||face_3" keys, dict values
"""
import sys
import os
import json
import pickle
import torch
import numpy as np
from typing import Dict, List, Tuple, Any, Optional

def load_pkl_database(pkl_path: str) -> Optional[Dict[str, Any]]:
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

def extract_embedding_from_face_data(face_data: Any) -> Optional[np.ndarray]:
    """Yüz verisi dict'inden embedding çıkar"""
    try:
        if isinstance(face_data, dict):
            # InsightFace formatı - yaygın key'leri dene
            for key in ['embedding', 'normed_embedding', 'feat', 'face_embedding']:
                if key in face_data:
                    embedding = face_data[key]
                    break
            else:
                # İlk numpy array/list'i bul
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

def parse_face_key(face_key: str) -> Tuple[str, str]:
    """
    Yeni PKL formatı: "IMG_2072.JPG||face_3" -> ("IMG_2072.JPG", "3")
    """
    try:
        if '||' in face_key:
            image_filename, face_part = face_key.split('||', 1)
            face_number = face_part.replace('face_', '')
            return image_filename, face_number
        else:
            # Fallback: eski format
            return face_key, '0'
    except Exception as e:
        print(f"⚠️ Face key parse hatası: {face_key} -> {e}", file=sys.stderr)
        return face_key, '0'

def match_faces(user_embedding: List[float], pkl_path: str, threshold: float = 0.5, model_path: Optional[str] = None) -> Dict:
    """PKL veritabanında yüz eşleştirmesi yap - Yeni PKL formatı için optimize"""
    try:
        print(f"🦬 PKL yüz eşleştirmesi başlıyor...", file=sys.stderr)
        print(f"📁 PKL dosyası: {pkl_path}", file=sys.stderr)
        print(f"🎯 Threshold: {threshold}", file=sys.stderr)
        
        # PKL veritabanını yükle
        pkl_data = load_pkl_database(pkl_path)
        if not pkl_data:
            return {"success": False, "error": "PKL dosyası yüklenemedi"}
        
        print(f"📊 PKL veritabanı yüklendi: {len(pkl_data)} kayıt", file=sys.stderr)
        
        # User embedding'i NumPy array'e çevir ve normalize et
        user_emb = np.array(user_embedding)
        if user_emb.ndim > 1:
            user_emb = user_emb.flatten()
        
        user_norm = np.linalg.norm(user_emb)
        if user_norm > 0:
            user_emb = user_emb / user_norm
            
        print(f"👤 User embedding: {user_emb.shape} boyut, norm: {user_norm:.3f}", file=sys.stderr)
        
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
                # Yeni PKL formatı key'lerini parse et
                image_filename, face_number = parse_face_key(face_key)
                image_name = os.path.basename(image_filename)
                
                # Model path ile tam yolu bul (eğer varsa)
                full_model_path = None
                if model_path:
                    full_model_path = os.path.join(model_path, image_filename).replace('\\', '/')
                
                matches.append({
                    "face_key": face_key,
                    "similarity": similarity,
                    "image_name": image_name,
                    "image_filename": image_filename,
                    "face_number": face_number,
                    "full_path": full_model_path,
                    "metadata": {
                        "type": "pkl_real_match", 
                        "threshold": threshold,
                        "embedding_dim": face_embedding.shape[0] if face_embedding is not None else 0,
                        "format": "new_pkl_format"
                    }
                })
                
                print(f"🎯 MATCH: {image_filename} (face_{face_number}) -> {similarity:.3f}", file=sys.stderr)
        
        # Similarity'ye göre sırala (yüksekten düşüğe)
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        
        print(f"📊 Sonuçlar:", file=sys.stderr)
        print(f"- Kontrol edilen yüz: {checked_faces}", file=sys.stderr) 
        print(f"- Threshold ({threshold}) üzeri eşleşme: {len(matches)}", file=sys.stderr)
        if matches:
            print(f"- En yüksek similarity: {matches[0]['similarity']:.3f}", file=sys.stderr)
            print(f"- En düşük similarity: {matches[-1]['similarity']:.3f}", file=sys.stderr)
        
        return {
            "success": True,
            "matches": matches,
            "total_faces": checked_faces,
            "threshold": threshold,
            "algorithm": "Real PKL InsightFace Matching - New Format",
            "format_info": "Keys: FILENAME.JPG||face_X, Values: dict with embeddings"
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