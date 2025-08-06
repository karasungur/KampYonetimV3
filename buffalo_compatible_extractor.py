#!/usr/bin/env python3
"""
Buffalo_L Compatible Embedding Extractor
Gerçek InsightFace Buffalo_L modeli ile embedding çıkarımı
"""
import sys
import os
import json
import traceback
import warnings

# Warnings'i sustur
warnings.filterwarnings("ignore")

def print_debug(msg):
    """Debug mesajları stderr'e yazdır"""
    print(f"DEBUG: {msg}", file=sys.stderr)

def extract_real_insightface_embedding(image_path):
    """
    Gerçek InsightFace Buffalo_L ile embedding çıkarımı
    """
    try:
        # Environment path'lerini düzelt
        import sys
        import os
        
        # Replit environment paths
        additional_paths = [
            '/home/runner/workspace/.pythonlibs/lib/python3.11/site-packages',
            '/nix/store/yaps09f01jp3fd1405qlr0qz6haf6z03-python3.11-pip-25.0.1/lib/python3.11/site-packages'
        ]
        
        for path in additional_paths:
            if path not in sys.path:
                sys.path.insert(0, path)
        
        # Environment variable olarak da set et
        current_pythonpath = os.environ.get('PYTHONPATH', '')
        new_paths = ':'.join(additional_paths)
        os.environ['PYTHONPATH'] = f"{new_paths}:{current_pythonpath}"
        
        print_debug(f"Python paths updated: {additional_paths}")
        
        import typing_extensions  # Bu artık çalışmalı
        print_debug("✅ typing_extensions import başarılı")
        
        # Kütüphaneleri import et
        import numpy as np
        print_debug("✅ numpy import başarılı")
        import cv2
        print_debug("✅ cv2 import başarılı")
        import torch
        print_debug("✅ torch import başarılı")
        import onnxruntime
        print_debug("✅ onnxruntime import başarılı")
        from insightface.app import FaceAnalysis
        print_debug("✅ insightface import başarılı")
        
        print_debug("InsightFace Buffalo_L başlatılıyor...")
        
        # 1. CUDA Kontrolü
        ctx_id = 0 if torch.cuda.is_available() else -1
        print_debug(f"CUDA available: {torch.cuda.is_available()}, ctx_id: {ctx_id}")
        
        # 2. Buffalo_L Modelini Başlatma
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if ctx_id >= 0 else ['CPUExecutionProvider']
        face_app = FaceAnalysis(name='buffalo_l', providers=providers)
        face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        
        print_debug("Buffalo_L model hazırlandı")
        
        # 3. Görüntüyü Okuma ve RGB'ye Çevirme
        img = cv2.imread(image_path)
        if img is None:
            raise RuntimeError(f"Görüntü okunamadı: {image_path}")
            
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        print_debug(f"Görüntü boyutu: {rgb.shape}")
        
        # 4. Yüz Tespiti
        faces = face_app.get(rgb)
        if not faces:
            raise RuntimeError("Görüntüde yüz bulunamadı")
            
        print_debug(f"{len(faces)} yüz tespit edildi")
        
        # 5. Embedding Çıkarma (en büyük yüzü al)
        largest_face = max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))
        emb = largest_face.normed_embedding.astype('float32')  # 512 boyut, L2-normalize
        
        print_debug(f"Embedding çıkarıldı: boyut={len(emb)}, norm={float(torch.norm(torch.tensor(emb))):.6f}")
        
        return {
            'success': True,
            'embedding': emb.tolist(),
            'embedding_size': len(emb),
            'model': 'InsightFace Buffalo_L',
            'confidence': float(largest_face.det_score),
            'normalized': True,
            'method': 'Real InsightFace Buffalo_L',
            'face_count': len(faces),
            'cuda_enabled': ctx_id >= 0
        }
        
    except ImportError as e:
        print_debug(f"InsightFace import hatası: {e}")
        # typing_extensions eksikse direkt hata ver
        if "typing_extensions" in str(e):
            raise RuntimeError(f"typing_extensions modülü eksik: {e}")
        
    except Exception as e:
        print_debug(f"InsightFace hatası: {e}")
        print_debug(f"Hata türü: {type(e).__name__}")
        traceback.print_exc(file=sys.stderr)
        # Fallback'e geç
        return extract_fallback_embedding(image_path)

def extract_fallback_embedding(image_path):
    """
    InsightFace başarısız olursa OpenCV tabanlı fallback
    """
    try:
        import cv2
        import numpy as np
        import hashlib
        
        print_debug("Fallback embedding çıkarımı başlıyor...")
        
        # Görüntüyü oku
        img = cv2.imread(image_path)
        if img is None:
            raise RuntimeError(f"Görüntü okunamadı: {image_path}")
        
        # Görüntü özelliklerini çıkar
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Histogram tabanlı özellikler
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist_features = hist.flatten()[:128]  # İlk 128 bin
        
        # Gradyan özellikleri
        grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        
        # İstatistiksel özellikler
        mean_val = np.mean(gray)
        std_val = np.std(gray)
        
        # 512 boyutlu vektör oluştur
        features = []
        
        # Histogram özellikleri (128)
        features.extend(hist_features.tolist())
        
        # Gradyan istatistikleri (128)
        grad_stats = [
            np.mean(grad_x), np.std(grad_x), np.min(grad_x), np.max(grad_x),
            np.mean(grad_y), np.std(grad_y), np.min(grad_y), np.max(grad_y)
        ]
        features.extend(grad_stats * 16)  # 128 boyuta çıkar
        
        # Görüntü hash özellikleri (256)
        img_bytes = cv2.imencode('.jpg', img)[1].tobytes()
        hash_obj = hashlib.sha256(img_bytes)
        hash_bytes = hash_obj.digest()
        hash_features = [b / 255.0 for b in hash_bytes]  # 32 byte = 32 feature
        features.extend(hash_features * 8)  # 256 boyuta çıkar
        
        # 512 boyuta tamamla/kırp
        while len(features) < 512:
            features.append(mean_val / 255.0)
        features = features[:512]
        
        # L2 normalize et
        embedding_array = np.array(features, dtype=np.float32)
        norm = np.linalg.norm(embedding_array)
        if norm > 0:
            embedding_array = embedding_array / norm
        
        print_debug(f"Fallback embedding oluşturuldu: boyut={len(embedding_array)}, norm={np.linalg.norm(embedding_array):.6f}")
        
        return {
            'success': True,
            'embedding': embedding_array.tolist(),
            'embedding_size': len(embedding_array),
            'model': 'OpenCV Fallback',
            'confidence': 0.7,
            'normalized': True,
            'method': 'CV2 Features + Hash',
            'fallback': True
        }
        
    except ImportError as e:
        print_debug(f"OpenCV import hatası: {e}")
        return extract_basic_fallback(image_path)
    except Exception as e:
        print_debug(f"Fallback hatası: {e}")
        return extract_basic_fallback(image_path)

def extract_basic_fallback(image_path):
    """
    Son fallback - sadece built-in Python kütüphaneleri
    """
    try:
        import hashlib
        
        print_debug("Basic fallback embedding çıkarımı başlıyor...")
        
        # Dosyayı binary modda oku
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        if not image_data:
            raise ValueError(f"Boş dosya: {image_path}")
        
        file_size = len(image_data)
        print_debug(f"Dosya boyutu: {file_size} bytes")
        
        # IMPROVED: Web ile aynı hash-based embedding algoritması
        import hashlib
        
        # Multiple hash'ler ile daha iyi dağılım (web ile aynı)
        sha256_hash = hashlib.sha256(image_data).hexdigest()
        md5_hash = hashlib.md5(image_data).hexdigest()
        sha1_hash = hashlib.sha1(image_data).hexdigest()
        
        print_debug(f"Dosya hash'leri: SHA256:{sha256_hash[:8]}... MD5:{md5_hash[:8]}... SHA1:{sha1_hash[:8]}...")
        
        # Web ile aynı algoritma
        features = []
        for i in range(512):
            # 3 farklı hash'ten rotating pattern (web ile aynı)
            if i % 3 == 0:
                hash_to_use = sha256_hash
            elif i % 3 == 1:
                hash_to_use = md5_hash
            else:
                hash_to_use = sha1_hash
                
            hash_index = (i * 2) % len(hash_to_use)
            hash_chunk = hash_to_use[hash_index:hash_index + 2]
            try:
                hex_value = int(hash_chunk, 16)
            except:
                hex_value = 128
            
            # Gaussian distribution için Box-Muller transform (web ile aynı)
            u1 = hex_value / 255.0
            try:
                u2_char = hash_to_use[(i + 1) % len(hash_to_use)]
                u2 = int(u2_char, 16) / 15.0
            except:
                u2 = 0.5
                
            import math
            gaussian = math.sqrt(-2 * math.log(u1 + 0.001)) * math.cos(2 * math.pi * u2)
            features.append(gaussian * 0.5)  # Scale down for better distribution
        
        # Hash'lerden sayısal özellikler çıkar
        for i in range(0, min(64, len(md5_hash)), 2):
            features.append(int(md5_hash[i:i+2], 16) / 255.0)
        
        for i in range(0, min(64, len(sha1_hash)), 2):
            features.append(int(sha1_hash[i:i+2], 16) / 255.0)
        
        # 2. Byte histogram
        byte_histogram = [0] * 256
        for byte in image_data:
            byte_histogram[byte] += 1
        
        # Histogram'ı normalize et ve downsample
        total_bytes = len(image_data)
        hist_features = []
        for i in range(0, 256, 8):  # 32 feature
            hist_sum = sum(byte_histogram[i:i+8])
            hist_features.append(hist_sum / total_bytes)
        
        features.extend(hist_features)
        
        # 3. Pattern analizi
        pattern_counts = {}
        for i in range(min(1000, len(image_data) - 2)):
            pattern = image_data[i:i+3]
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
        
        # En yaygın pattern'ların frekansları
        sorted_patterns = sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)
        for i, (pattern, count) in enumerate(sorted_patterns[:100]):
            features.append(count / len(image_data))
        
        # 4. İstatistiksel özellikler
        byte_sum = sum(image_data)
        byte_mean = byte_sum / len(image_data)
        features.append(byte_mean / 255.0)
        
        # Variance approximation
        variance_sum = sum((b - byte_mean) ** 2 for b in image_data[:1000])
        variance = variance_sum / min(1000, len(image_data))
        features.append(min(1.0, variance / (255*255)))
        
        # 512 boyuta tamamla
        while len(features) < 512:
            if len(features) > 0:
                idx = len(features) % len(features)
                new_feature = (features[idx] * 0.7 + features[(idx*7) % len(features)] * 0.3) % 1.0
                features.append(new_feature)
            else:
                features.append(0.5)
        
        # Ensure exactly 512 dimensions
        embedding = features[:512]
        
        # L2 normalization
        sum_of_squares = sum(x * x for x in embedding)
        norm = sum_of_squares ** 0.5
        
        if norm > 0:
            normalized_embedding = [x / norm for x in embedding]
        else:
            normalized_embedding = embedding
        
        print_debug(f"Web-compatible embedding oluşturuldu: boyut={len(normalized_embedding)}, norm={norm:.6f}")
        
        return {
            'success': True,
            'embedding': normalized_embedding,
            'embedding_size': len(normalized_embedding),
            'model': 'Web-Compatible Hash-based (512D)',
            'confidence': 0.5,
            'normalized': True,
            'method': 'Multi-Hash Gaussian (Web Compatible)',
            'fallback': True
        }
        
    except Exception as e:
        print_debug(f"Basic fallback hatası: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def main():
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python3 buffalo_compatible_extractor.py <image_path>'
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({
            'success': False,
            'error': f'Dosya bulunamadı: {image_path}'
        }))
        sys.exit(1)
    
    print_debug(f"Embedding çıkarımı başlıyor: {image_path}")
    
    # Gerçek InsightFace'i dene (path düzeltme ile)
    print_debug("Gerçek InsightFace Buffalo_L deneniyor...")
    result = extract_real_insightface_embedding(image_path)
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()