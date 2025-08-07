/**
 * InsightFace Buffalo-S Lite ONNX Runtime for Web
 * Gerçek 512D embeddings için web-based çözüm
 */

import * as ort from 'onnxruntime-web';

class BuffaloSLiteONNX {
  private session: ort.InferenceSession | null = null;
  private isLoaded = false;
  private modelUrl = 'https://huggingface.co/MonsterMMORPG/buffalo_s/resolve/main/w600k_r50.onnx';

  constructor() {
    // ONNX Runtime Web için optimize edilmiş ayarlar
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
    ort.env.wasm.numThreads = 1; // Daha stabil için tek thread
  }

  async loadModel(): Promise<boolean> {
    try {
      console.log('🦬 Buffalo-S Lite ONNX model yükleniyor...');
      console.log('📦 Model URL:', this.modelUrl);
      
      // Buffalo-S Lite modelini yükle
      this.session = await ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ['wasm', 'cpu'],
        graphOptimizationLevel: 'all'
      });
      
      console.log('✅ Buffalo-S Lite model başarıyla yüklendi');
      console.log('🔍 Model inputs:', this.session.inputNames);
      console.log('🔍 Model outputs:', this.session.outputNames);
      
      this.isLoaded = true;
      return true;
      
    } catch (error) {
      console.error('❌ Buffalo-S Lite model yükleme hatası:', error);
      console.error('⚠️ ONNX model yüklenemedi - gerçek embedding için server gerekli');
      this.isLoaded = false;
      return false; // Fallback YOK - hata durumunda false dön
    }
  }

  async extractEmbedding(imageElement: HTMLImageElement): Promise<number[] | null> {
    try {
      if (!this.isLoaded || !this.session) {
        console.error('❌ Buffalo-S Lite model yüklenemedi - gerçek embedding gerekli');
        throw new Error('ONNX model yüklenmedi, gerçek embedding çıkarılamıyor');
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

export const buffaloSLite = new BuffaloSLiteONNX();