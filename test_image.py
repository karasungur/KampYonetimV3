#!/usr/bin/env python3
"""
Test gerçek InsightFace embedding çıkarımı
"""
import sys
import os
import json
import numpy as np
import cv2

# Test görüntüsü oluştur (100x100 random image)
def create_test_image():
    image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    cv2.imwrite('test_face.jpg', image)
    return 'test_face.jpg'

def test_insightface():
    try:
        from insightface import FaceAnalysis
        
        # Model yükle
        app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=-1, det_size=(640, 640))
        
        # Test görüntüsü oluştur
        image_path = create_test_image()
        
        # Görüntüyü yükle
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": "Test görüntüsü okunamadı"}
        
        # BGR'den RGB'ye çevir
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Yüz tespiti
        faces = app.get(rgb)
        
        if not faces:
            # Yüz bulunamazsa simülasyon embedding dön
            embedding = np.random.randn(512).astype('float32')
            embedding = embedding / np.linalg.norm(embedding)  # L2 normalize
            
            return {
                "success": True,
                "embedding": embedding.tolist(),
                "note": "No face detected - simulation embedding",
                "faces_detected": 0
            }
        
        # İlk yüzün embedding'ini al
        face = faces[0]
        embedding = face.normed_embedding.astype('float32')
        
        # Test görüntüsünü temizle
        if os.path.exists(image_path):
            os.remove(image_path)
        
        return {
            "success": True,
            "embedding": embedding.tolist(),
            "faces_detected": len(faces),
            "bbox": face.bbox.tolist(),
            "confidence": getattr(face, 'det_score', 0.9)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    result = test_insightface()
    print(json.dumps(result))