#!/usr/bin/env python3
"""
GPU/CUDA Tespit Test Scripti
"""

import torch
import sys

def test_device_detection():
    """Device detection test"""
    print("🔍 Device Detection Test")
    print("=" * 40)
    
    # PyTorch version
    print(f"📦 PyTorch Version: {torch.__version__}")
    
    # CUDA availability
    cuda_available = torch.cuda.is_available()
    print(f"🎮 CUDA Available: {cuda_available}")
    
    if cuda_available:
        device_count = torch.cuda.device_count()
        print(f"📊 GPU Count: {device_count}")
        
        for i in range(device_count):
            gpu_name = torch.cuda.get_device_name(i)
            memory_gb = torch.cuda.get_device_properties(i).total_memory // 1024**3
            print(f"   GPU {i}: {gpu_name} ({memory_gb} GB)")
        
        print("✅ GPU Mode - CUDA destekli işleme mümkün")
        
        # Test tensor creation
        try:
            test_tensor = torch.randn(100, 100).cuda()
            print("✅ GPU Memory Test: Başarılı")
        except Exception as e:
            print(f"❌ GPU Memory Test: {str(e)}")
        
    else:
        print("⚠️ CPU Mode - GPU acceleration unavailable")
    
    print("=" * 40)
    
    # InsightFace provider test
    try:
        from insightface.app import FaceAnalysis
        
        # Provider listesi oluştur
        providers = []
        if cuda_available:
            providers.append('CUDAExecutionProvider')
            providers.append('CPUExecutionProvider')  # Fallback
            print("🚀 FaceAnalysis will use: GPU (CUDA)")
        else:
            providers.append('CPUExecutionProvider')
            print("💻 FaceAnalysis will use: CPU")
        
        print(f"📋 ONNX Providers: {providers}")
        print("✅ InsightFace import: Başarılı")
        
    except Exception as e:
        print(f"❌ InsightFace import error: {str(e)}")
    
    print("=" * 40)
    return cuda_available

if __name__ == "__main__":
    gpu_available = test_device_detection()
    sys.exit(0 if gpu_available else 1)