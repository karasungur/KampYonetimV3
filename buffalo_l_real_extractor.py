#!/usr/bin/env python3
import sys
import os
import time
import traceback
import warnings
import numpy as np
import cv2
import torch
from insightface.app import FaceAnalysis

# Uyarıları bastır
warnings.filterwarnings("ignore", category=FutureWarning, message=".*rcond parameter.*")
warnings.filterwarnings("ignore", category=RuntimeWarning)

def extract_buffalo_l_embedding(image_path):
    """
    Gerçek InsightFace Buffalo_L model kullanarak embedding çıkarır
    Attached code'dan uyarlanan gerçek implementasyon
    """
    try:
        # FaceAnalysis başlatma - attached code'dan
        ctx_id = 0 if torch.cuda.is_available() else -1
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if ctx_id >= 0 else ['CPUExecutionProvider']
        
        try:
            face_app = FaceAnalysis(name='buffalo_l', providers=providers)
            face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
            print("✅ InsightFace Buffalo_L initialized with CUDA" if ctx_id >= 0 else "✅ InsightFace Buffalo_L initialized with CPU")
        except Exception as cuda_error:
            print(f"⚠️ CUDA initialization failed, falling back to CPU: {cuda_error}")
            face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
            face_app.prepare(ctx_id=-1, det_size=(640, 640))
            print("✅ InsightFace Buffalo_L initialized with CPU fallback")

        # Resmi yükle - attached code'dan
        try:
            with open(image_path, 'rb') as f:
                img_data = np.frombuffer(f.read(), np.uint8)
            img = cv2.imdecode(img_data, cv2.IMREAD_COLOR)
            print(f"📐 Dosya boyutu: {os.path.getsize(image_path)} bytes")
        except Exception as e:
            print(f"❌ Resim açılamadı: {image_path}: {str(e)}")
            return None

        if img is None:
            print(f"❌ Resim yüklenemedi: {image_path}")
            return None

        # BGR'den RGB'ye çevir - attached code'dan
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        try:
            # Gerçek InsightFace yüz tespiti - attached code'dan
            faces = face_app.get(rgb)
            print(f"🔍 Tespit edilen yüz sayısı: {len(faces)}")
        except Exception as e:
            print(f"❌ Yüz tespiti başarısız: {image_path}: {str(e)}")
            return None

        if not faces:
            print(f"❌ Resimde yüz bulunamadı: {image_path}")
            return None

        # İlk yüz için embedding al - attached code'dan
        first_face = faces[0]
        embedding = first_face.normed_embedding.astype('float32')
        
        print(f"✅ Gerçek Buffalo_L embedding çıkarıldı: {embedding.shape} boyut")
        print(f"🔢 Embedding değer aralığı: [{embedding.min():.3f}, {embedding.max():.3f}]")
        print(f"📊 Embedding normu: {np.linalg.norm(embedding):.3f}")
        
        return embedding.tolist()

    except Exception as e:
        print(f"❌ Buffalo_L embedding extraction hatası: {str(e)}")
        print(f"🔍 Traceback: {traceback.format_exc()}")
        return None

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("❌ Kullanım: python buffalo_l_real_extractor.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"❌ Dosya bulunamadı: {image_path}")
        sys.exit(1)
    
    print(f"🦬 Gerçek InsightFace Buffalo_L ile embedding çıkarılıyor...")
    print(f"📁 Dosya: {image_path}")
    
    embedding = extract_buffalo_l_embedding(image_path)
    
    if embedding is not None:
        print(f"✅ Başarılı! {len(embedding)} boyutlu gerçek Buffalo_L embedding")
        # JSON formatında çıktı ver (Node.js tarafından parse edilecek)
        import json
        print("EMBEDDING_RESULT:", json.dumps({
            "success": True,
            "embedding": embedding,
            "embedding_size": len(embedding),
            "model": "InsightFace Buffalo_L Real"
        }))
    else:
        print("❌ Embedding çıkarılamadı")
        print("EMBEDDING_RESULT:", json.dumps({
            "success": False,
            "error": "Failed to extract embedding"
        }))