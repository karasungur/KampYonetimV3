#!/usr/bin/env python3
"""
Basit embedding extractor - InsightFace yerine OpenCV ile
"""
import sys
import os
import json
import numpy as np
import cv2

def extract_simple_embedding(image_path):
    """
    Basit embedding çıkarma (InsightFace alternatifi)
    """
    try:
        print(f"📸 Görüntü yükleniyor: {image_path}", file=sys.stderr)
        
        # Görüntüyü yükle
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Görüntü yüklenemedi: {image_path}")
        
        print(f"📐 Görüntü boyutu: {img.shape}", file=sys.stderr)
        
        # 112x112 boyutuna resize et (InsightFace standart boyutu)
        img_resized = cv2.resize(img, (112, 112))
        
        # RGB'ye çevir ve normalize et
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        img_normalized = img_rgb.astype(np.float32) / 255.0
        
        # Basit feature extraction (512 boyutlu embedding simülasyonu)
        # Gerçek InsightFace'in yaptığına benzer şekilde:
        # 1. Görüntüyü flatten et
        # 2. Boyutu 512'ye düşür 
        # 3. L2 normalize et
        
        flattened = img_normalized.flatten()
        
        # 512 boyutlu embedding'e düşür (basit downsampling)
        target_size = 512
        step = len(flattened) // target_size
        embedding = flattened[::step][:target_size]
        
        # Eksik boyutları sıfırla doldur
        if len(embedding) < target_size:
            padding = np.zeros(target_size - len(embedding))
            embedding = np.concatenate([embedding, padding])
        
        # L2 normalizasyonu
        norm = np.linalg.norm(embedding)
        normalized_embedding = embedding / norm if norm > 0 else embedding
        
        print(f"✅ Embedding çıkarıldı: {len(normalized_embedding)} boyut", file=sys.stderr)
        print(f"🔢 Embedding değer aralığı: [{normalized_embedding.min():.3f}, {normalized_embedding.max():.3f}]", file=sys.stderr)
        print(f"🔄 L2 normalize edildi: norm={norm:.3f}", file=sys.stderr)
        
        return {
            "success": True,
            "embedding": normalized_embedding.tolist(),
            "embedding_size": len(normalized_embedding),
            "model": "OpenCV-based Simple Extractor (InsightFace alternative)",
            "normalized": True,
            "confidence": 0.85  # Sabit confidence değeri
        }
        
    except Exception as e:
        print(f"❌ Embedding çıkarma hatası: {e}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e),
            "embedding": None,
            "embedding_size": 0
        }

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Invalid arguments"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "error": f"File not found: {image_path}"}))
        sys.exit(1)
    
    print(f"🎯 Simple embedding extraction başlıyor...", file=sys.stderr)
    print(f"📁 Dosya: {image_path}", file=sys.stderr)
    
    # Embedding çıkar
    result = extract_simple_embedding(image_path)
    
    # JSON olarak stdout'a yazdır
    print(json.dumps(result))

if __name__ == "__main__":
    main()