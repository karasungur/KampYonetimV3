#!/usr/bin/env python3
"""
User embedding çıkarma testi - Her seferinde farklı mı çıkıyor?
"""
import sys
import os
import json
import numpy as np

def test_embedding_extraction(image_path):
    """Test embedding çıkarma"""
    try:
        print(f"🧪 Test embedding çıkarma: {image_path}")
        
        from subprocess import run, PIPE
        
        # Buffalo compatible extractor'ı 3 kez çalıştır
        for i in range(3):
            print(f"\n🔄 Test {i+1}/3:")
            
            try:
                result = run([
                    'python3', 'buffalo_compatible_extractor.py', image_path
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    embedding_result = json.loads(result.stdout.strip())
                    if embedding_result.get('success'):
                        embedding = embedding_result['embedding']
                        print(f"   ✅ Embedding boyut: {len(embedding)}")
                        print(f"   İlk 5 değer: {embedding[:5]}")
                        print(f"   Son 5 değer: {embedding[-5:]}")
                        print(f"   Ortalama: {np.mean(embedding):.6f}")
                        print(f"   L2 Norm: {np.linalg.norm(embedding):.6f}")
                    else:
                        print(f"   ❌ Embedding çıkarma başarısız: {embedding_result.get('error')}")
                else:
                    print(f"   ❌ Script başarısız, kod: {result.returncode}")
                    print(f"   Stderr: {result.stderr}")
                    
            except Exception as e:
                print(f"   ❌ Test hatası: {e}")
        
    except Exception as e:
        print(f"❌ Test genel hatası: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_user_embedding.py <image_path>")
        sys.exit(1)
    
    test_embedding_extraction(sys.argv[1])