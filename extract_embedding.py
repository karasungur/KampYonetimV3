#!/usr/bin/env python3
import sys
import os
import json
import numpy as np
import cv2
import insightface
from insightface.app import FaceAnalysis

def extract_face_embedding(image_path):
    """Fotoğraftan InsightFace ile 512 boyutlu embedding çıkarır"""
    try:
        # InsightFace model yükle
        app = FaceAnalysis(providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=0, det_size=(640, 640))
        
        # Fotoğrafı oku
        image = cv2.imread(image_path)
        if image is None:
            return {"error": "Fotoğraf okunamadı"}
        
        # Face detection
        faces = app.get(image)
        
        if len(faces) == 0:
            return {"error": "Hiç yüz bulunamadı"}
        
        # İlk yüzün embedding'ini al
        face = faces[0]
        embedding = face.embedding
        
        # Numpy array'i Python list'e çevir ve float precision azalt
        embedding_list = [round(float(x), 6) for x in embedding.tolist()]
        
        return {
            "success": True,
            "embedding": embedding_list,
            "embedding_size": len(embedding_list),
            "faces_count": len(faces),
            "confidence": round(float(face.det_score) if hasattr(face, 'det_score') else 1.0, 4)
        }
        
    except Exception as e:
        return {"error": f"Hata: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Kullanım: python extract_embedding.py <image_path>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": "Fotoğraf dosyası bulunamadı"}))
        sys.exit(1)
    
    result = extract_face_embedding(image_path)
    print(json.dumps(result))