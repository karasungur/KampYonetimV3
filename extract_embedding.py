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
        # InsightFace model yükle (orijinal GUI ile aynı şekilde)
        import torch
        ctx_id = 0 if torch.cuda.is_available() else -1
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if ctx_id >= 0 else ['CPUExecutionProvider']
        
        try:
            app = FaceAnalysis(name='buffalo_l', providers=providers)
            app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        except Exception:
            app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
            app.prepare(ctx_id=-1, det_size=(640, 640))
        
        # Fotoğrafı oku
        image = cv2.imread(image_path)
        if image is None:
            return {"error": "Fotoğraf okunamadı"}
        
        # Face detection
        faces = app.get(image)
        
        if len(faces) == 0:
            return {"error": "Hiç yüz bulunamadı"}
        
        # İlk yüzün embedding'ini al (normalize edilmiş)
        face = faces[0]
        embedding = face.normed_embedding
        
        # Numpy array'i Python list'e çevir ve float precision azalt
        embedding_list = [round(float(x), 6) for x in embedding.tolist()]
        
        # Very compact JSON output
        result = {
            "s": 1,  # success
            "e": embedding_list,  # embedding
            "l": len(embedding_list),  # length
            "f": len(faces),  # faces count  
            "c": round(float(face.det_score) if hasattr(face, 'det_score') else 1.0, 4)  # confidence
        }
        
        return result
        
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