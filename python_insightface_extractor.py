#!/usr/bin/env python3
"""
InsightFace Buffalo_L Embedding Extractor
Hibrit yaklaşım: Face-API (kırpma) + InsightFace Buffalo_L (embedding)
"""
import sys
import os
import traceback
import json
import numpy as np
import cv2
from datetime import datetime

try:
    import insightface
    from insightface.app import FaceAnalysis
    import torch
    print("✅ InsightFace kütüphaneleri yüklendi", file=sys.stderr)
except ImportError as e:
    print(f"❌ InsightFace kütüphanesi yüklenemedi: {e}", file=sys.stderr)
    print("🔄 Fallback çözüm kullanılacak", file=sys.stderr)
    
    # Fallback: simüle edilmiş embedding döndür
    def extract_embedding_from_cropped_face(image_path):
        return {
            "success": False,
            "error": f"InsightFace kurulum hatası: {e}",
            "embedding": None,
            "embedding_size": 0,
            "fallback_needed": True
        }
    
    def main():
        if len(sys.argv) != 2:
            print(json.dumps({"success": False, "error": "Invalid arguments"}))
            sys.exit(1)
        
        result = extract_embedding_from_cropped_face(sys.argv[1])
        print(json.dumps(result))
    
    if __name__ == "__main__":
        main()
    sys.exit(0)

def extract_embedding_from_cropped_face(image_path):
    """
    Kırpılmış yüz fotoğrafından InsightFace Buffalo_L embedding çıkarır
    """
    try:
        print(f"🦬 InsightFace Buffalo_L başlatılıyor...", file=sys.stderr)
        
        # CUDA varsa kullan, yoksa CPU
        ctx_id = 0 if torch.cuda.is_available() else -1
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if ctx_id >= 0 else ['CPUExecutionProvider']
        
        try:
            face_app = FaceAnalysis(name='buffalo_l', providers=providers)
            face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
            print(f"✅ Buffalo_L model hazırlandı ({'GPU' if ctx_id >= 0 else 'CPU'})", file=sys.stderr)
        except Exception:
            # Fallback to CPU
            face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
            face_app.prepare(ctx_id=-1, det_size=(640, 640))
            print("✅ Buffalo_L model hazırlandı (CPU fallback)", file=sys.stderr)
        
        # Görüntüyü yükle
        print(f"📸 Görüntü yükleniyor: {image_path}", file=sys.stderr)
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Görüntü yüklenemedi: {image_path}")
        
        print(f"📐 Görüntü boyutu: {img.shape}", file=sys.stderr)
        
        # Yüz tespit et (kırpılmış görüntüde tek yüz bekliyoruz)
        faces = face_app.get(img)
        
        if len(faces) == 0:
            print("⚠️ Kırpılmış görüntüde yüz bulunamadı", file=sys.stderr)
            # Boş embedding döndür
            return {
                "success": False,
                "error": "Kırpılmış görüntüde yüz tespit edilemedi",
                "embedding": None,
                "embedding_size": 0
            }
        
        # İlk (ve tek olması beklenen) yüzün embedding'ini al
        face = faces[0]
        embedding = face.embedding
        
        print(f"✅ Embedding çıkarıldı: {embedding.shape}", file=sys.stderr)
        print(f"📊 Embedding boyutu: {len(embedding)}", file=sys.stderr)
        print(f"🔢 Embedding değer aralığı: [{embedding.min():.3f}, {embedding.max():.3f}]", file=sys.stderr)
        
        # L2 normalizasyonu uygula
        norm = np.linalg.norm(embedding)
        normalized_embedding = embedding / norm if norm > 0 else embedding
        
        print(f"🔄 L2 normalize edildi: norm={norm:.3f}", file=sys.stderr)
        
        return {
            "success": True,
            "embedding": normalized_embedding.tolist(),
            "embedding_size": len(normalized_embedding),
            "model": "InsightFace Buffalo_L",
            "normalized": True,
            "confidence": float(face.det_score) if hasattr(face, 'det_score') else 1.0
        }
        
    except Exception as e:
        print(f"❌ Embedding çıkarma hatası: {e}", file=sys.stderr)
        print(f"🔍 Detay: {traceback.format_exc()}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e),
            "embedding": None,
            "embedding_size": 0
        }

def main():
    if len(sys.argv) != 2:
        print("❌ Kullanım: python3 python_insightface_extractor.py <image_path>", file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"❌ Dosya bulunamadı: {image_path}", file=sys.stderr)
        sys.exit(1)
    
    print(f"🎯 InsightFace Buffalo_L embedding çıkarma başlıyor...", file=sys.stderr)
    print(f"📁 Dosya: {image_path}", file=sys.stderr)
    
    # Embedding çıkar
    result = extract_embedding_from_cropped_face(image_path)
    
    # JSON olarak stdout'a yazdır
    print(json.dumps(result))

if __name__ == "__main__":
    main()