import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

export class InsightFaceBuffaloL {
  private session: ort.InferenceSession | null = null;
  private modelPath: string;

  constructor() {
    this.modelPath = path.join(process.cwd(), 'models', 'buffalo_l.onnx');
  }

  async loadModel(): Promise<void> {
    try {
      console.log('🦬 InsightFace Buffalo_L model yükleniyor...');
      
      // Model dosyasının var olup olmadığını kontrol et
      if (!fs.existsSync(this.modelPath)) {
        console.log('⚠️ Buffalo_L model dosyası bulunamadı, simüle edilmiş embedding kullanılacak');
        throw new Error(`Model dosyası bulunamadı: ${this.modelPath}`);
      }

      console.log(`📁 Model dosyası bulundu: ${this.modelPath}`);
      console.log(`📊 Model boyutu: ${(fs.statSync(this.modelPath).size / 1024 / 1024).toFixed(2)} MB`);

      // ONNX session oluştur
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpu'], // CPU provider kullan
        logSeverityLevel: 3, // ERROR level
      });

      console.log('✅ InsightFace Buffalo_L model başarıyla yüklendi');
      console.log('📋 Model input shapes:', this.session.inputNames.map(name => {
        const metadata = this.session?.inputMetadata[name];
        return `${name}: ${metadata?.dims?.join('x') || 'unknown'}`;
      }));
      
    } catch (error) {
      console.error('❌ InsightFace Buffalo_L model yükleme hatası:', error);
      throw error;
    }
  }

  async preprocessImage(imageBuffer: Buffer): Promise<ort.Tensor> {
    try {
      console.log('🖼️ Görüntü ön işleme başlıyor...');
      
      // Sharp ile görüntüyü işle  
      const processedImage = await sharp(imageBuffer)
        .resize(112, 112) // InsightFace standart boyutu
        .removeAlpha() // Alpha kanalını kaldır
        .raw()
        .toBuffer();

      console.log('📐 Görüntü boyutu: 112x112');

      // RGB değerlerini normalize et [0-255] -> [-1, 1]
      const float32Data = new Float32Array(3 * 112 * 112);
      for (let i = 0; i < processedImage.length; i += 3) {
        // RGB -> CHW format (Channel-Height-Width)
        const r = processedImage[i] / 127.5 - 1.0;
        const g = processedImage[i + 1] / 127.5 - 1.0;
        const b = processedImage[i + 2] / 127.5 - 1.0;

        const pixelIndex = Math.floor(i / 3);
        const h = Math.floor(pixelIndex / 112);
        const w = pixelIndex % 112;

        // CHW format: [C, H, W]
        float32Data[0 * 112 * 112 + h * 112 + w] = r; // R channel
        float32Data[1 * 112 * 112 + h * 112 + w] = g; // G channel
        float32Data[2 * 112 * 112 + h * 112 + w] = b; // B channel
      }

      // ONNX Tensor oluştur
      const tensor = new ort.Tensor('float32', float32Data, [1, 3, 112, 112]);
      console.log('✅ Tensor oluşturuldu:', tensor.dims);
      
      return tensor;
    } catch (error) {
      console.error('❌ Görüntü ön işleme hatası:', error);
      throw error;
    }
  }

  async extractEmbedding(imageBuffer: Buffer): Promise<number[]> {
    try {
      if (!this.session) {
        await this.loadModel();
      }

      console.log('🔍 Embedding çıkarma başlıyor...');
      
      // Görüntüyü ön işle
      const inputTensor = await this.preprocessImage(imageBuffer);

      // Model inference
      const feeds: Record<string, ort.Tensor> = {};
      feeds[this.session!.inputNames[0]] = inputTensor;

      console.log('🧠 Model inference çalışıyor...');
      const results = await this.session!.run(feeds);

      // Output tensor'ı al
      const outputName = this.session!.outputNames[0];
      const outputTensor = results[outputName];
      
      console.log('📊 Output tensor boyutu:', outputTensor.dims);
      
      // Float32Array'den normal array'e çevir
      const embedding = Array.from(outputTensor.data as Float32Array);
      
      console.log(`✅ Embedding çıkarıldı: ${embedding.length} boyutlu`);
      console.log(`📈 Embedding range: [${Math.min(...embedding).toFixed(3)}, ${Math.max(...embedding).toFixed(3)}]`);
      
      return embedding;
    } catch (error) {
      console.error('❌ Embedding çıkarma hatası:', error);
      throw error;
    }
  }

  async isModelReady(): Promise<boolean> {
    return this.session !== null;
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
      console.log('🗑️ InsightFace Buffalo_L model temizlendi');
    }
  }
}

// Singleton instance
export const insightFaceModel = new InsightFaceBuffaloL();