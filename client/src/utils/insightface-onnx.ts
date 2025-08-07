/**
 * Buffalo-S Lite Client-Side ONNX Implementation
 * Pure client-side 512D face embeddings
 * Optimized for web browsers with ONNX Runtime Web
 */

import * as ort from 'onnxruntime-web';

class BuffaloSLiteClientONNX {
  private session: ort.InferenceSession | null = null;
  private isLoaded = false;
  // GERÇEK ÇALIŞAN InsightFace Buffalo model URL'leri
  private modelUrls = [
    // ONNX Recognition model (w600k_r50.onnx) - Buffalo-L
    'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx',
    'https://huggingface.co/lithiumice/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx',
    'https://huggingface.co/yolkailtd/face-swap-models/resolve/main/insightface/models/buffalo_l/w600k_r50.onnx',
    
    // Local model (eğer mevcutsa)
    './models/buffalo_s/w600k_r50.onnx',
    './models/buffalo_l/w600k_r50.onnx',
  ];

  constructor() {
    // ONNX Runtime Web için basitleştirilmiş CDN ayarları
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/';
    ort.env.wasm.numThreads = 1; // Stabil için tek thread
    ort.env.wasm.simd = false; // SIMD deaktif, daha stabil
  }

  async loadModel(): Promise<boolean> {
    if (this.isLoaded) {
      console.log('🦬 Buffalo-S Lite zaten yüklü');
      return true;
    }
    
    // Birden fazla URL'yi sırayla dene
    for (let i = 0; i < this.modelUrls.length; i++) {
      const modelUrl = this.modelUrls[i];
      try {
        console.log(`🦬 Buffalo-S Lite client-side yükleniyor... (${i+1}/${this.modelUrls.length})`);
        console.log('📦 Model URL:', modelUrl);
        
        // Buffalo-S Lite client-side ONNX - basitleştirilmiş config
        this.session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          executionMode: 'sequential',
          enableCpuMemArena: false,
          enableMemPattern: false
        });
        
        console.log('✅ Buffalo-S Lite client model başarıyla yüklendi');
        console.log('🔍 Input: ', this.session.inputNames[0]);
        console.log('🔍 Output:', this.session.outputNames[0]);
        
        this.isLoaded = true;
        return true; // Başarılı olunca çık
        
      } catch (error) {
        console.error(`❌ Buffalo-S Lite URL ${i+1} hatası:`, error);
        
        // Son URL'de de başarısız olursa false döndür
        if (i === this.modelUrls.length - 1) {
          console.error('❌ KRITIK: Tüm Buffalo-S Lite URL\'leri başarısız - Model yüklenemedi!');
          this.isLoaded = false;
          return false;
        }
      }
    }
    
    return false;
  }

  async extractEmbedding(imageElement: HTMLImageElement): Promise<number[] | null> {
    try {
      if (!this.isLoaded || !this.session) {
        console.error('❌ Buffalo-S Lite client model yüklenmedi');
        throw new Error('Client-side Buffalo-S Lite model yüklenmedi');
      }

      // Canvas'a çiz ve preprocess
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Buffalo-S input format: 112x112, RGB
      canvas.width = 112;
      canvas.height = 112;
      
      if (!ctx) throw new Error('Canvas context oluşturulamadı');
      
      ctx.drawImage(imageElement, 0, 0, 112, 112);
      const imageData = ctx.getImageData(0, 0, 112, 112);
      
      // RGB format and normalization
      const input = new Float32Array(3 * 112 * 112);
      let idx = 0;
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        input[idx] = (imageData.data[i] - 127.5) / 127.5;     // R
        input[idx + 112 * 112] = (imageData.data[i + 1] - 127.5) / 127.5; // G  
        input[idx + 2 * 112 * 112] = (imageData.data[i + 2] - 127.5) / 127.5; // B
        idx++;
      }
      
      // Run inference
      const inputTensor = new ort.Tensor('float32', input, [1, 3, 112, 112]);
      const results = await this.session.run({ [this.session.inputNames[0]]: inputTensor });
      
      // Extract embedding (output should be 512D)
      const outputTensor = results[this.session.outputNames[0]];
      const embedding = Array.from(outputTensor.data as Float32Array);
      
      // L2 normalize
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      const normalizedEmbedding = embedding.map(val => val / norm);
      
      console.log(`✅ Buffalo-S Lite embedding: ${normalizedEmbedding.length}D, norm=${norm.toFixed(6)}`);
      return normalizedEmbedding;
      
    } catch (error) {
      console.error('❌ Buffalo-S Lite embedding hatası:', error);
      throw error; // Fallback yok, hata fırlat
    }
  }

  // Hash-based fallback KALDIRILDI - sadece gerçek embedding

  isModelLoaded(): boolean {
    return this.isLoaded;
  }

  async initialize(): Promise<boolean> {
    if (this.isLoaded) return true;
    return await this.loadModel();
  }
}

// Export both class and instance
export { BuffaloSLiteClientONNX };
export const buffaloSLite = new BuffaloSLiteClientONNX();
export default BuffaloSLiteClientONNX;