import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireRole, generateToken, comparePassword, hashPassword, type AuthenticatedRequest } from "./auth";
import { insertUserSchema, insertQuestionSchema, insertAnswerSchema, insertFeedbackSchema, insertProgramEventSchema, insertUploadedFileSchema, insertPageLayoutSchema, insertPageElementSchema, insertPhotoRequestSchema, insertDetectedFaceSchema, insertPhotoDatabaseSchema, insertPhotoMatchSchema, insertProcessingQueueSchema, insertCampDaySchema, insertPhotoRequestDaySchema, insertFaceModelSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import axios from "axios";
import AdmZip from "adm-zip";
import { spawn, exec } from "child_process";
import { promisify } from 'util';

const execAsync = promisify(exec);

// JavaScript Cosine Similarity hesaplama fonksiyonu
function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    console.warn(`Embedding boyutları eşleşmiyor: ${a.length} vs ${b.length}`);
    return 0.0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0.0;
  }
  
  return dotProduct / magnitude;
}

// Object Storage için gerekli importlar
let ObjectStorageService: any;
try {
  // Object storage şu an mock olarak çalışıyor
  ObjectStorageService = null;
} catch (error) {
  console.warn('Object storage not available:', (error as Error).message);
}

// Server tarafında gerçek ONNX neural network embedding çıkarımı
async function extractInsightFaceEmbedding(imagePath: string): Promise<{
  success: boolean;
  embedding?: number[];
  error?: string;
  processing_time?: number;
}> {
  try {
    console.log('🦬 Server tarafında gerçek ONNX neural network embedding çıkarımı:', imagePath);
    
    const startTime = Date.now();
    
    // Node.js ONNX Runtime ile gerçek neural network
    const { nodeInsightFace } = await import('./insightface-buffalo.js');
    
    // Model yüklü değilse yükle
    if (!nodeInsightFace.isModelLoaded()) {
      const loaded = await nodeInsightFace.loadModel();
      if (!loaded) {
        return {
          success: false,
          error: 'ONNX neural network model yüklenemedi'
        };
      }
    }
    
    // Gerçek neural network embedding çıkarımı
    const result = await nodeInsightFace.extractEmbedding(imagePath);
    
    const processingTime = Date.now() - startTime;
    
    if (result.success && result.embedding) {
      console.log(`✅ Server ONNX neural network embedding başarılı: ${result.embedding.length}D, süre: ${processingTime}ms`);
      return {
        success: true,
        embedding: result.embedding,
        processing_time: processingTime
      };
    } else {
      console.error('❌ Server ONNX embedding hatası:', result.error);
      return {
        success: false,
        error: result.error || 'Server-side neural network embedding çıkarılamadı'
      };
    }
    
  } catch (error) {
    console.error('❌ Server ONNX neural network embedding hatası:', error);
    return {
      success: false,
      error: `Server neural network hatası: ${error.message}`
    };
  }
}

// TC Kimlik doğrulama fonksiyonu
function validateTCNumber(tc: string): boolean {
  if (tc.length !== 11) return false;
  if (!/^\d+$/.test(tc)) return false;
  
  const digits = tc.split('').map(Number);
  const firstDigit = digits[0];
  if (firstDigit === 0) return false;
  
  // TC algoritması kontrolü
  let oddSum = 0, evenSum = 0;
  for (let i = 0; i < 9; i++) {
    if (i % 2 === 0) oddSum += digits[i];
    else evenSum += digits[i];
  }
  
  const tenthDigit = ((oddSum * 7) - evenSum) % 10;
  if (tenthDigit !== digits[9]) return false;
  
  const total = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  const eleventhDigit = total % 10;
  
  return eleventhDigit === digits[10];
}

// Rate Limiting yapılandırmaları
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // Maksimum 5 deneme
  message: 'Çok fazla giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
});

const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 10, // Maksimum 10 kullanıcı oluşturma
  message: 'Çok fazla kullanıcı oluşturma denemesi. Lütfen daha sonra tekrar deneyin.',
});

// File upload configuration
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${nanoid()}_${Date.now()}${ext}`;
      cb(null, filename);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Sadece resim dosyaları yüklenebilir') as any;
      error.code = 'INVALID_FILE_TYPE';
      cb(error, false);
    }
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // Maksimum 100 istek
  message: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
});

// Login schema
const loginSchema = z.object({
  tcNumber: z.string().length(11, "T.C. Kimlik Numarası 11 haneli olmalıdır")
    .refine(validateTCNumber, "Geçersiz T.C. Kimlik Numarası"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Sadece JSON dosyaları kabul edilir'));
    }
  }
});

// User import schema
const userImportSchema = z.object({
  isim: z.string().min(1, "İsim zorunludur"),
  soyisim: z.string().min(1, "Soyisim zorunludur"),
  tc: z.string().length(11, "T.C. Kimlik Numarası 11 haneli olmalıdır")
    .refine(validateTCNumber, "Geçersiz T.C. Kimlik Numarası"),
  sifre: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  rol: z.enum(['genelsekreterlik', 'genelbaskan', 'moderator'], {
    errorMap: () => ({ message: "Geçersiz rol" })
  }),
  masaNo: z.number().optional(),
  masaAdi: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Genel API rate limiting (belirli rotalar hariç)
  app.use('/api/', (req, res, next) => {
    // Bu rotalar rate limiting'den muaf:
    // - Auth rotaları (zaten kendi limitleri var)
    // - Fotoğraf işleme rotaları (büyük dosya yüklemeleri için)
    if (req.path.startsWith('/api/auth/') || 
        req.path.startsWith('/api/photo-requests')) {
      return next();
    }
    apiLimiter(req, res, next);
  });

  // Auth routes
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const { tcNumber, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByTcNumber(tcNumber);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' });
      }

      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' });
      }

      // Update last login
      await storage.updateUserLastLogin(user.id);

      // Log activity
      await storage.logActivity({
        userId: user.id,
        action: 'login',
        details: 'Kullanıcı sisteme giriş yaptı',
        ipAddress: req.ip,
      });

      const token = generateToken(user);
      
      res.json({ 
        token, 
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tableNumber: user.tableNumber,
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ message: 'Giriş bilgileri geçersiz' });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user) {
        await storage.logActivity({
          userId: req.user.id,
          action: 'logout',
          details: 'Kullanıcı sistemden çıkış yaptı',
          ipAddress: req.ip,
        });
      }
      res.json({ message: 'Çıkış başarılı' });
    } catch (error) {
      res.status(500).json({ message: 'Çıkış hatası' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
      }
      
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tableNumber: user.tableNumber,
      });
    } catch (error) {
      res.status(500).json({ message: 'Kullanıcı bilgileri alınamadı' });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'İstatistikler alınamadı' });
    }
  });

  // User management routes (genelsekreterlik only)
  app.get('/api/users', requireAuth, requireRole(['genelsekreterlik']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Kullanıcılar alınamadı' });
    }
  });

  app.post('/api/users', requireAuth, requireRole(['genelsekreterlik']), createAccountLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Hash password
      userData.password = await hashPassword(userData.password);
      
      const user = await storage.createUser(userData);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'create_user',
        details: `Yeni kullanıcı oluşturuldu: ${user.firstName} ${user.lastName}`,
        metadata: { createdUserId: user.id },
        ipAddress: req.ip,
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error('Create user error:', error);
      res.status(400).json({ message: 'Kullanıcı oluşturulamadı' });
    }
  });

  app.put('/api/users/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = insertUserSchema.partial().parse(req.body);
      
      // Hash password if provided
      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }
      
      const user = await storage.updateUser(id, updates);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'edit_user',
        details: `Kullanıcı güncellendi: ${user.firstName} ${user.lastName}`,
        metadata: { editedUserId: user.id },
        ipAddress: req.ip,
      });
      
      res.json(user);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(400).json({ message: 'Kullanıcı güncellenemedi' });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { deleteFeedback, deleteAnswers } = req.query;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
      }
      
      // Delete associated data if requested
      if (deleteFeedback === 'true') {
        await storage.deleteFeedbackByUser(id);
      }
      
      if (deleteAnswers === 'true') {
        await storage.deleteAnswersByUser(id);
      }
      
      await storage.deleteUser(id);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'delete_user',
        details: `Kullanıcı silindi: ${user.firstName} ${user.lastName}`,
        metadata: { 
          deletedUserId: user.id,
          deletedFeedback: deleteFeedback === 'true',
          deletedAnswers: deleteAnswers === 'true'
        },
        ipAddress: req.ip,
      });
      
      res.json({ message: 'Kullanıcı başarıyla silindi' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Kullanıcı silinemedi' });
    }
  });

  app.post('/api/users/import', requireAuth, requireRole(['genelsekreterlik']), upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Dosya gereklidir' });
      }

      const jsonData = JSON.parse(req.file.buffer.toString());
      
      // Validate array
      if (!Array.isArray(jsonData)) {
        return res.status(400).json({ message: 'JSON dosyası bir dizi olmalıdır' });
      }

      let imported = 0;
      let tablesCreated = 0;
      const errors: string[] = [];
      const createdTables = new Set<number>();

      for (let i = 0; i < jsonData.length; i++) {
        try {
          const userData = userImportSchema.parse(jsonData[i]);
          
          // Check if user already exists
          const existingUser = await storage.getUserByTcNumber(userData.tc);
          if (existingUser) {
            errors.push(`Satır ${i + 1}: TC ${userData.tc} zaten kayıtlı`);
            continue;
          }

          // If table number is provided, check if table exists
          if (userData.masaNo && !createdTables.has(userData.masaNo)) {
            const existingTable = await storage.getTableByNumber(userData.masaNo);
            if (!existingTable) {
              // Create table
              const tableName = userData.masaAdi || `Masa ${userData.masaNo}`;
              await storage.createTable({
                number: userData.masaNo,
                name: tableName,
                isActive: true,
              });
              createdTables.add(userData.masaNo);
              tablesCreated++;
            }
          }

          // Create user
          const hashedPassword = await hashPassword(userData.sifre);
          await storage.createUser({
            firstName: userData.isim,
            lastName: userData.soyisim,
            tcNumber: userData.tc,
            password: hashedPassword,
            role: userData.rol,
            tableNumber: userData.masaNo || null,
            isActive: true,
          });
          
          imported++;
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(`Satır ${i + 1}: ${error.errors.map(e => e.message).join(', ')}`);
          } else {
            errors.push(`Satır ${i + 1}: Bilinmeyen hata`);
          }
        }
      }

      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'import_users',
        details: `${imported} kullanıcı içe aktarıldı${tablesCreated > 0 ? `, ${tablesCreated} masa oluşturuldu` : ''}`,
        metadata: { imported, tablesCreated, errors: errors.length },
        ipAddress: req.ip,
      });

      res.json({
        imported,
        tablesCreated,
        total: jsonData.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error('Import users error:', error);
      res.status(400).json({ message: 'İçe aktarma başarısız' });
    }
  });

  // Question management routes
  app.get('/api/questions', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Pagination parametreleri
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
      const offset = (page - 1) * limit;
      
      let result;
      
      if (req.user!.role === 'moderator' && req.user!.tableNumber) {
        // Moderators only see questions assigned to their table
        result = await storage.getQuestionsForTable(req.user!.tableNumber, { limit, offset });
      } else {
        // Admins see all questions
        result = await storage.getAllQuestions({ limit, offset });
      }
      
      res.json({
        data: result.questions,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Sorular alınamadı' });
    }
  });

  app.post('/api/questions', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const questionData = insertQuestionSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });
      
      const question = await storage.createQuestion(questionData);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'create_question',
        details: `Yeni soru oluşturuldu: ${question.text.substring(0, 50)}...`,
        metadata: { questionId: question.id },
        ipAddress: req.ip,
      });
      
      res.status(201).json(question);
    } catch (error) {
      console.error('Create question error:', error);
      res.status(400).json({ message: 'Soru oluşturulamadı' });
    }
  });

  app.put('/api/questions/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = insertQuestionSchema.partial().parse(req.body);
      
      const question = await storage.updateQuestion(id, updates);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'edit_question',
        details: `Soru güncellendi: ${question.text.substring(0, 50)}...`,
        metadata: { questionId: question.id },
        ipAddress: req.ip,
      });
      
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: 'Soru güncellenemedi' });
    }
  });

  app.delete('/api/questions/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      const question = await storage.getQuestion(id);
      if (!question) {
        return res.status(404).json({ message: 'Soru bulunamadı' });
      }
      
      await storage.deleteQuestion(id);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'delete_question',
        details: `Soru silindi: ${question.text.substring(0, 50)}...`,
        metadata: { questionId: id },
        ipAddress: req.ip,
      });
      
      res.json({ message: 'Soru silindi' });
    } catch (error) {
      res.status(500).json({ message: 'Soru silinemedi' });
    }
  });

  // Answer routes
  app.get('/api/questions/:questionId/answers', requireAuth, async (req, res) => {
    try {
      const { questionId } = req.params;
      const answers = await storage.getAnswersForQuestion(questionId);
      res.json(answers);
    } catch (error) {
      res.status(500).json({ message: 'Cevaplar alınamadı' });
    }
  });

  app.get('/api/answers/my', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const answers = await storage.getAnswersForUser(req.user!.id);
      res.json(answers);
    } catch (error) {
      res.status(500).json({ message: 'Cevaplar alınamadı' });
    }
  });

  app.get('/api/answers', requireAuth, requireRole(['genelbaskan', 'genelsekreterlik']), async (req, res) => {
    try {
      const answers = await storage.getAllAnswers();
      res.json(answers);
    } catch (error) {
      res.status(500).json({ message: 'Cevaplar alınamadı' });
    }
  });

  app.post('/api/answers', requireAuth, requireRole(['moderator']), async (req: AuthenticatedRequest, res) => {
    try {
      const answerData = insertAnswerSchema.parse({
        ...req.body,
        userId: req.user!.id,
        tableNumber: req.user!.tableNumber,
      });
      
      const answer = await storage.createAnswer(answerData);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'create_answer',
        details: `Yeni cevap eklendi`,
        metadata: { questionId: answer.questionId, answerId: answer.id },
        ipAddress: req.ip,
      });
      
      res.status(201).json(answer);
    } catch (error) {
      console.error('Create answer error:', error);
      res.status(400).json({ message: 'Cevap eklenemedi' });
    }
  });

  app.put('/api/answers/:id', requireAuth, requireRole(['moderator']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = insertAnswerSchema.partial().parse(req.body);
      
      const answer = await storage.updateAnswer(id, updates);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'edit_answer',
        details: `Cevap güncellendi`,
        metadata: { questionId: answer.questionId, answerId: answer.id },
        ipAddress: req.ip,
      });
      
      res.json(answer);
    } catch (error) {
      res.status(400).json({ message: 'Cevap güncellenemedi' });
    }
  });

  app.delete('/api/answers/:id', requireAuth, requireRole(['moderator']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      await storage.deleteAnswer(id);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'delete_answer',
        details: `Cevap silindi`,
        metadata: { answerId: id },
        ipAddress: req.ip,
      });
      
      res.json({ message: 'Cevap silindi' });
    } catch (error) {
      res.status(500).json({ message: 'Cevap silinemedi' });
    }
  });

  // Feedback routes
  app.get('/api/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      let feedbackItems;
      
      if (req.user!.role === 'genelsekreterlik') {
        // Genelsekreterlik can see all feedback
        feedbackItems = await storage.getAllFeedback();
      } else if (req.user!.role === 'moderator') {
        // Moderators can only see their own feedback
        feedbackItems = await storage.getFeedbackForUser(req.user!.id);
      } else {
        return res.status(403).json({ message: 'Bu sayfaya erişim yetkiniz yok' });
      }
      
      res.json(feedbackItems);
    } catch (error) {
      res.status(500).json({ message: 'Geri bildirimler alınamadı' });
    }
  });

  app.post('/api/feedback', requireAuth, requireRole(['moderator']), async (req: AuthenticatedRequest, res) => {
    try {
      const feedbackData = insertFeedbackSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      
      const feedbackItem = await storage.createFeedback(feedbackData);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'send_feedback',
        details: `Geri bildirim gönderildi`,
        metadata: { questionId: feedbackData.questionId, feedbackId: feedbackItem.id },
        ipAddress: req.ip,
      });
      
      res.status(201).json(feedbackItem);
    } catch (error) {
      res.status(400).json({ message: 'Geri bildirim gönderilemedi' });
    }
  });

  app.put('/api/feedback/:id/read', requireAuth, requireRole(['genelsekreterlik']), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markFeedbackAsRead(id);
      res.json({ message: 'Geri bildirim okundu olarak işaretlendi' });
    } catch (error) {
      res.status(500).json({ message: 'İşlem gerçekleştirilemedi' });
    }
  });

  app.put('/api/feedback/:id/resolve', requireAuth, requireRole(['genelsekreterlik']), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markFeedbackAsResolved(id);
      res.json({ message: 'Geri bildirim çözüldü olarak işaretlendi' });
    } catch (error) {
      res.status(500).json({ message: 'İşlem gerçekleştirilemedi' });
    }
  });

  app.put('/api/feedback/:id/respond', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;
      
      if (!response || response.trim() === '') {
        return res.status(400).json({ message: 'Yanıt metni gereklidir' });
      }
      
      await storage.respondToFeedback(id, response, req.user!.id);
      
      res.json({ message: 'Geri bildirime yanıt verildi' });
    } catch (error) {
      res.status(500).json({ message: 'Yanıt gönderilemedi' });
    }
  });

  app.delete('/api/feedback/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      const feedback = await storage.getFeedback(id);
      if (!feedback) {
        return res.status(404).json({ message: 'Geri bildirim bulunamadı' });
      }
      
      await storage.deleteFeedback(id);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'delete_answer', // Using delete_answer since there's no delete_feedback action
        details: `Geri bildirim silindi`,
        metadata: { feedbackId: id },
        ipAddress: req.ip,
      });
      
      res.json({ message: 'Geri bildirim başarıyla silindi' });
    } catch (error) {
      console.error('Delete feedback error:', error);
      res.status(500).json({ message: 'Geri bildirim silinemedi' });
    }
  });

  // Activity logs
  app.get('/api/logs', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      // Moderators can only see their own logs
      if (req.user!.role === 'moderator') {
        const logs = await storage.getActivityLogsForUser(req.user!.id, limit);
        res.json(logs);
      } else {
        // General Secretary and General President can see all logs
        const logs = await storage.getActivityLogs(limit);
        res.json(logs);
      }
    } catch (error) {
      res.status(500).json({ message: 'Loglar alınamadı' });
    }
  });

  // Tables
  app.get('/api/tables', requireAuth, async (req, res) => {
    try {
      const tablesList = await storage.getAllTablesWithDetails();
      res.json(tablesList);
    } catch (error) {
      res.status(500).json({ message: 'Masalar alınamadı' });
    }
  });



  // Table management routes (genelsekreterlik only)
  app.post('/api/tables', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { number, name } = req.body;
      
      // Validate input
      if (!number || number <= 0) {
        return res.status(400).json({ message: 'Geçerli bir masa numarası giriniz' });
      }

      const table = await storage.createTable({ number, name });
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'create_user', // We don't have create_table action in the enum, using create_user
        details: `Yeni masa oluşturuldu: Masa ${number}`,
        metadata: { tableId: table.id },
        ipAddress: req.ip,
      });
      
      res.status(201).json(table);
    } catch (error: any) {
      console.error('Error creating table:', error);
      if (error.code === '23505') {
        res.status(400).json({ message: 'Bu masa numarası zaten mevcut' });
      } else {
        res.status(500).json({ message: 'Masa oluşturulurken hata oluştu' });
      }
    }
  });

  app.put('/api/tables/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Masa adı gereklidir' });
      }
      
      const table = await storage.updateTable(id, { name });
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'edit_user', // Using edit_user since there's no edit_table action
        details: `Masa güncellendi: ${table.name}`,
        metadata: { tableId: table.id },
        ipAddress: req.ip,
      });
      
      res.json(table);
    } catch (error) {
      console.error('Update table error:', error);
      res.status(500).json({ message: 'Masa güncellenemedi' });
    }
  });

  app.delete('/api/tables/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const table = await storage.getTable(id);
      
      if (!table) {
        return res.status(404).json({ message: 'Masa bulunamadı' });
      }
      
      await storage.deleteTable(id);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'delete_user', // We don't have delete_table action in the enum, using delete_user
        details: `Masa silindi: Masa ${table.number}`,
        metadata: { tableId: id },
        ipAddress: req.ip,
      });
      
      res.status(200).json({ message: 'Masa başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting table:', error);
      res.status(500).json({ message: 'Masa silinirken hata oluştu' });
    }
  });

  // Export routes
  app.get('/api/export/answers', requireAuth, requireRole(['genelbaskan', 'genelsekreterlik']), async (req, res) => {
    try {
      const format = req.query.format as string || 'csv';
      const allAnswers = await storage.getAllAnswers();
      
      // Sıralama: Önce soru metni, sonra masa numarası
      const answers = allAnswers.sort((a, b) => {
        // Önce soru metnine göre sırala
        const questionCompare = (a.questionText || '').localeCompare(b.questionText || '', 'tr-TR');
        if (questionCompare !== 0) return questionCompare;
        
        // Soru aynı ise masa numarasına göre sırala
        return (a.tableNumber || 0) - (b.tableNumber || 0);
      });
      
      if (format === 'csv') {
        const csv = [
          ['Soru', 'Masa No', 'Cevap', 'Cevaplayan', 'Tarih'].join(','),
          ...answers.map(answer => [
            `"${answer.questionText || 'Bilinmeyen'}"`,
            answer.tableNumber,
            `"${answer.text.replace(/"/g, '""')}"`,
            `"${answer.userName || 'Bilinmeyen'}"`,
            new Date(answer.createdAt).toLocaleString('tr-TR')
          ].join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="cevaplar.csv"');
        res.send('\ufeff' + csv); // UTF-8 BOM for Excel
      } else if (format === 'xlsx') {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Create worksheet data
        const wsData = [
          ['Soru', 'Masa No', 'Cevap', 'Cevaplayan', 'Tarih'],
          ...answers.map(answer => [
            answer.questionText || 'Bilinmeyen',
            answer.tableNumber || '',
            answer.text,
            answer.userName || 'Bilinmeyen',
            new Date(answer.createdAt).toLocaleString('tr-TR')
          ])
        ];
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Set column widths
        ws['!cols'] = [
          { width: 50 }, // Soru
          { width: 10 }, // Masa No
          { width: 80 }, // Cevap
          { width: 20 }, // Cevaplayan
          { width: 20 }  // Tarih
        ];
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Cevaplar');
        
        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="cevaplar.xlsx"');
        res.send(buffer);
      } else if (format === 'txt') {
        const txt = answers.map(answer => 
          `SORU: ${answer.questionText || 'Bilinmeyen'}\n` +
          `MASA NO: ${answer.tableNumber || '-'}\n` +
          `CEVAP: ${answer.text}\n` +
          `CEVAPLAYAN: ${answer.userName || 'Bilinmeyen'}\n` +
          `TARİH: ${new Date(answer.createdAt).toLocaleString('tr-TR')}\n` +
          `${'='.repeat(80)}\n`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="cevaplar.txt"');
        res.send('\ufeff' + txt); // UTF-8 BOM
      } else {
        res.status(400).json({ message: 'Desteklenmeyen format' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Export başarısız' });
    }
  });

  app.get('/api/export/users', requireAuth, requireRole(['genelsekreterlik']), async (req, res) => {
    try {
      const format = req.query.format as string || 'csv';
      const allUsers = await storage.getAllUsers();
      
      // Sıralama: Önce rol, sonra masa numarası, sonra ad-soyad
      const users = allUsers.sort((a, b) => {
        // Önce role göre sırala (genelsekreterlik, genelbaskan, moderator)
        const roleOrder = { genelsekreterlik: 1, genelbaskan: 2, moderator: 3 };
        const roleCompare = (roleOrder[a.role as keyof typeof roleOrder] || 4) - (roleOrder[b.role as keyof typeof roleOrder] || 4);
        if (roleCompare !== 0) return roleCompare;
        
        // Rol aynı ise masa numarasına göre sırala
        const tableCompare = (a.tableNumber || 0) - (b.tableNumber || 0);
        if (tableCompare !== 0) return tableCompare;
        
        // Masa da aynı ise ada göre sırala
        const nameCompare = a.firstName.localeCompare(b.firstName, 'tr-TR');
        if (nameCompare !== 0) return nameCompare;
        
        // Ad da aynı ise soyada göre sırala
        return a.lastName.localeCompare(b.lastName, 'tr-TR');
      });
      
      if (format === 'csv') {
        const csv = [
          ['Ad', 'Soyad', 'TC No', 'Rol', 'Masa No', 'Son Giriş', 'Cevap Sayısı'].join(','),
          ...users.map(user => [
            `"${user.firstName}"`,
            `"${user.lastName}"`,
            user.tcNumber,
            user.role,
            user.tableNumber || '',
            user.lastLogin ? new Date(user.lastLogin).toLocaleString('tr-TR') : 'Yok',
            user.answersCount || 0
          ].join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="kullanicilar.csv"');
        res.send('\ufeff' + csv); // UTF-8 BOM for Excel
      } else {
        res.status(400).json({ message: 'Desteklenmeyen format' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Export başarısız' });
    }
  });

  // Menu Settings Routes
  app.get('/api/menu-settings', async (req, res) => {
    try {
      const settings = await storage.getMenuSettings();
      if (!settings) {
        // Varsayılan ayarları döndür
        const defaultSettings = {
          moderatorLoginEnabled: true,
          programFlowEnabled: false,
          photosEnabled: false,
          socialMediaEnabled: false,
          teamEnabled: false,
          moderatorLoginTitle: "Moderatör Girişi",
          programFlowTitle: "Program Akışı",
          photosTitle: "Fotoğraflar",
          socialMediaTitle: "Sosyal Medya",
          teamTitle: "Ekibimiz",
        };
        res.json(defaultSettings);
      } else {
        res.json(settings);
      }
    } catch (error) {
      res.status(500).json({ message: 'Menü ayarları alınamadı' });
    }
  });

  app.put('/api/menu-settings', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await storage.updateMenuSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: 'Menü ayarları güncellenemedi' });
    }
  });

  // Program Events Routes
  app.get('/api/program-events', async (req, res) => {
    try {
      const events = await storage.getAllProgramEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: 'Program etkinlikleri alınamadı' });
    }
  });

  app.post('/api/program-events', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const eventData = insertProgramEventSchema.parse(req.body);
      const event = await storage.createProgramEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      console.error('Create program event error:', error);
      res.status(400).json({ message: 'Etkinlik oluşturulamadı' });
    }
  });

  app.put('/api/program-events/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const eventData = insertProgramEventSchema.partial().parse(req.body);
      const event = await storage.updateProgramEvent(id, eventData);
      res.json(event);
    } catch (error) {
      console.error('Update program event error:', error);
      res.status(400).json({ message: 'Etkinlik güncellenemedi' });
    }
  });

  app.delete('/api/program-events/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProgramEvent(id);
      res.json({ message: 'Etkinlik silindi' });
    } catch (error) {
      res.status(400).json({ message: 'Etkinlik silinemedi' });
    }
  });

  // Social Media Accounts Routes
  app.get('/api/social-media-accounts', async (req, res) => {
    try {
      const accounts = await storage.getAllSocialMediaAccounts();
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ message: 'Sosyal medya hesapları alınamadı' });
    }
  });

  app.post('/api/social-media-accounts', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const account = await storage.createSocialMediaAccount(req.body);
      res.status(201).json(account);
    } catch (error) {
      res.status(400).json({ message: 'Sosyal medya hesabı oluşturulamadı' });
    }
  });

  app.put('/api/social-media-accounts/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const account = await storage.updateSocialMediaAccount(id, req.body);
      res.json(account);
    } catch (error) {
      res.status(400).json({ message: 'Sosyal medya hesabı güncellenemedi' });
    }
  });

  app.delete('/api/social-media-accounts/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSocialMediaAccount(id);
      res.json({ message: 'Sosyal medya hesabı silindi' });
    } catch (error) {
      res.status(400).json({ message: 'Sosyal medya hesabı silinemedi' });
    }
  });

  // Team Members Routes
  app.get('/api/team-members', async (req, res) => {
    try {
      const members = await storage.getAllTeamMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: 'Ekip üyeleri alınamadı' });
    }
  });

  app.post('/api/team-members', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const member = await storage.createTeamMember(req.body);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ message: 'Ekip üyesi oluşturulamadı' });
    }
  });

  app.put('/api/team-members/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const member = await storage.updateTeamMember(id, req.body);
      res.json(member);
    } catch (error) {
      res.status(400).json({ message: 'Ekip üyesi güncellenemedi' });
    }
  });

  app.delete('/api/team-members/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTeamMember(id);
      res.json({ message: 'Ekip üyesi silindi' });
    } catch (error) {
      res.status(400).json({ message: 'Ekip üyesi silinemedi' });
    }
  });

  // File upload endpoints
  app.post('/api/upload', requireAuth, requireRole(['genelsekreterlik']), imageUpload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Dosya yüklenemedi' });
      }

      const fileData = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: `/uploads/${req.file.filename}`,
        uploadedBy: req.user!.id,
      };

      const uploadedFile = await storage.createUploadedFile(fileData);
      res.status(201).json(uploadedFile);
    } catch (error) {
      console.error('File upload error:', error);
      res.status(400).json({ message: 'Dosya yüklenemedi' });
    }
  });

  app.get('/api/uploaded-files', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const files = await storage.getAllUploadedFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: 'Dosyalar getirilemedi' });
    }
  });

  app.delete('/api/uploaded-files/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const file = await storage.getUploadedFile(id);
      
      if (file) {
        // Delete physical file
        const filePath = path.join(process.cwd(), 'public', file.filePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await storage.deleteUploadedFile(id);
      res.json({ message: 'Dosya silindi' });
    } catch (error) {
      res.status(400).json({ message: 'Dosya silinemedi' });
    }
  });

  // Page layout endpoints
  app.get('/api/page-layouts', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const layouts = await storage.getAllPageLayouts();
      res.json(layouts);
    } catch (error) {
      res.status(500).json({ message: 'Sayfa düzenleri getirilemedi' });
    }
  });

  app.get('/api/page-layouts/active', async (req, res) => {
    try {
      const layout = await storage.getActivePageLayout();
      res.json(layout || null);
    } catch (error) {
      res.status(500).json({ message: 'Aktif sayfa düzeni getirilemedi' });
    }
  });

  app.get('/api/page-layouts/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const layout = await storage.getPageLayout(id);
      
      if (!layout) {
        return res.status(404).json({ message: 'Sayfa düzeni bulunamadı' });
      }
      
      res.json(layout);
    } catch (error) {
      res.status(500).json({ message: 'Sayfa düzeni getirilemedi' });
    }
  });

  app.post('/api/page-layouts', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const layoutData = insertPageLayoutSchema.parse(req.body);
      const layout = await storage.createPageLayout(layoutData);
      res.status(201).json(layout);
    } catch (error) {
      console.error('Create page layout error:', error);
      res.status(400).json({ message: 'Sayfa düzeni oluşturulamadı' });
    }
  });

  app.put('/api/page-layouts/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = insertPageLayoutSchema.partial().parse(req.body);
      const layout = await storage.updatePageLayout(id, updates);
      res.json(layout);
    } catch (error) {
      res.status(400).json({ message: 'Sayfa düzeni güncellenemedi' });
    }
  });

  app.delete('/api/page-layouts/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deletePageLayout(id);
      res.json({ message: 'Sayfa düzeni silindi' });
    } catch (error) {
      res.status(400).json({ message: 'Sayfa düzeni silinemedi' });
    }
  });

  // Page element endpoints
  app.get('/api/page-elements/:layoutId', async (req, res) => {
    try {
      const { layoutId } = req.params;
      const elements = await storage.getPageElementsByLayout(layoutId);
      res.json(elements);
    } catch (error) {
      res.status(500).json({ message: 'Sayfa öğeleri getirilemedi' });
    }
  });

  app.post('/api/page-elements', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const elementData = insertPageElementSchema.parse(req.body);
      const element = await storage.createPageElement(elementData);
      res.status(201).json(element);
    } catch (error) {
      console.error('Create page element error:', error);
      res.status(400).json({ message: 'Sayfa öğesi oluşturulamadı' });
    }
  });

  app.put('/api/page-elements/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = insertPageElementSchema.partial().parse(req.body);
      const element = await storage.updatePageElement(id, updates);
      res.json(element);
    } catch (error) {
      res.status(400).json({ message: 'Sayfa öğesi güncellenemedi' });
    }
  });

  app.put('/api/page-elements/:id/position', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { positionX, positionY } = req.body;
      
      if (typeof positionX !== 'number' || typeof positionY !== 'number') {
        return res.status(400).json({ message: 'Geçersiz pozisyon değerleri' });
      }
      
      await storage.updateElementPosition(id, positionX, positionY);
      res.json({ message: 'Pozisyon güncellendi' });
    } catch (error) {
      res.status(400).json({ message: 'Pozisyon güncellenemedi' });
    }
  });

  app.delete('/api/page-elements/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deletePageElement(id);
      res.json({ message: 'Sayfa öğesi silindi' });
    } catch (error) {
      res.status(400).json({ message: 'Sayfa öğesi silinemedi' });
    }
  });

  // =============================================================================
  // FOTOĞRAF YÖNETİMİ API ROTALARI
  // =============================================================================

  // Object Storage upload URL endpoint (Real Object Storage)
  app.post('/api/objects/upload', async (req, res) => {
    try {
      const { filename } = req.body;
      
      if (!filename) {
        return res.status(400).json({ error: 'Filename gerekli' });
      }
      
      // Generate presigned URL for Object Storage upload
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      
      if (!bucketId || !privateDir) {
        return res.status(500).json({ error: 'Object Storage yapılandırılmamış' });
      }
      
      // Create object path in private directory
      const objectPath = `${privateDir}/${filename}`;
      
      // Generate presigned URL using Replit's sidecar endpoint
      const sidecarEndpoint = 'http://127.0.0.1:1106';
      const signRequest = {
        bucket_name: bucketId,
        object_name: filename,
        method: 'PUT',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
      };
      
      const response = await fetch(`${sidecarEndpoint}/object-storage/signed-object-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signRequest)
      });
      
      if (!response.ok) {
        throw new Error(`Presigned URL oluşturulamadı: ${response.status}`);
      }
      
      const { signed_url: uploadURL } = await response.json();
      
      res.json({ uploadURL });
    } catch (error) {
      console.error('Object Storage upload URL error:', error);
      res.status(500).json({ error: 'Upload URL alınamadı: ' + (error as Error).message });
    }
  });

  // Object Storage file serving endpoint
  app.get('/objects/:objectPath(*)', async (req, res) => {
    try {
      const objectPath = req.params.objectPath;
      
      if (!objectPath) {
        return res.status(400).json({ error: 'Object path gerekli' });
      }
      
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      
      if (!bucketId || !privateDir) {
        return res.status(500).json({ error: 'Object Storage yapılandırılmamış' });
      }
      
      // Generate presigned URL for download
      const sidecarEndpoint = 'http://127.0.0.1:1106';
      const signRequest = {
        bucket_name: bucketId,
        object_name: objectPath,
        method: 'GET',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      };
      
      const response = await fetch(`${sidecarEndpoint}/object-storage/signed-object-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signRequest)
      });
      
      if (!response.ok) {
        return res.status(404).json({ error: 'Dosya bulunamadı' });
      }
      
      const { signed_url: downloadURL } = await response.json();
      
      // Redirect to the actual file for download
      res.redirect(302, downloadURL);
      
    } catch (error) {
      console.error('Object Storage serve error:', error);
      res.status(500).json({ error: 'Dosya servis edilemedi: ' + (error as Error).message });
    }
  });
  
  // Geçici upload endpoint (Development) - Backward compatibility
  app.put('/api/upload-temp/:id', imageUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Dosya yüklenemedi' });
      }
      
      // Upload URL'ini döndür
      const uploadURL = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      res.json({ 
        uploadURL,
        message: 'Dosya başarıyla yüklendi'
      });
    } catch (error) {
      console.error('Temp upload error:', error);
      res.status(500).json({ error: 'Dosya yüklenemedi' });
    }
  });

  // Node.js InsightFace Buffalo_L Embedding Endpoint
  app.post('/api/extract-embedding', imageUpload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'Yüz fotoğrafı gönderilmedi' 
        });
      }

      console.log('🦬 Gerçek InsightFace Python embedding çıkarma:', req.file.filename, req.file.size, 'bytes');
      
      // Gerçek InsightFace embedding çıkarımı - Python script kullan
      const result = await extractInsightFaceEmbedding(req.file.path);
      
      // Dosyayı temizle
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      if (result.success && result.embedding) {
        console.log(`✅ Gerçek InsightFace embedding başarılı: ${result.embedding.length}D`);
        res.json({
          success: true,
          embedding: result.embedding,
          embedding_size: result.embedding.length,
          model: 'InsightFace Buffalo (Python)',
          message: 'Gerçek InsightFace embedding çıkarıldı',
          processing_time: result.processing_time
        });
      } else {
        console.error('❌ InsightFace embedding hatası:', result.error);
        res.status(500).json({ 
          success: false, 
          message: result.error || 'Gerçek embedding çıkarılamadı - InsightFace kurulumu kontrol edin'
        });
      }
      
    } catch (error) {
      console.error('❌ Embedding extraction error:', error);
      
      // Dosyayı temizle
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Embedding çıkarımında hata oluştu' 
      });
    }
  });

  // Yeni fotoğraf talebi oluşturma
  app.post('/api/photo-requests', async (req, res) => {
    try {
      // Debug: Ham veriyi kontrol et
      console.log('🔍 req.body içeriği:', Object.keys(req.body));
      console.log('🔍 faceData var mı:', req.body.faceData ? 'VAR' : 'YOK');
      
      const { selectedCampDays, uploadedFilesCount, ...requestBody } = req.body;
      
      // Debug: Destructuring sonrası
      console.log('🔍 requestBody içeriği:', Object.keys(requestBody));
      console.log('🔍 requestBody.faceData:', requestBody.faceData ? 'VAR' : 'YOK');
      
      const requestData = insertPhotoRequestSchema.parse({
        ...requestBody,
        email: req.body.email || `temp_${requestBody.tcNumber}@example.com`, // Email artık opsiyonel
        faceData: req.body.faceData, // Web'den gelen yüz embedding verileri
        status: 'pending'
      });
      
      // Debug: Parse sonrası
      console.log('🔍 requestData.faceData:', requestData.faceData ? 'VAR' : 'YOK');
      
      // TC kimlik doğrulama
      if (!validateTCNumber(requestData.tcNumber)) {
        return res.status(400).json({ message: 'Geçersiz TC kimlik numarası' });
      }
      
      // Önceki session kontrolü
      const existingSession = await storage.getPhotoMatchingSessionByTc(requestData.tcNumber);
      if (existingSession) {
        return res.status(400).json({ 
          message: 'Bu TC kimlik numarası için zaten bir yüz eşleştirme session\'ı mevcut',
          existingSession 
        });
      }
      
      // Debug: Gelen veriyi kontrol et
      console.log('📥 Web\'den gelen fotoğraf isteği:');
      console.log('- TC:', requestData.tcNumber);
      console.log('- Face Data (raw):', req.body.faceData ? `${Array.isArray(req.body.faceData) ? req.body.faceData.length : 'VAR'} adet` : 'YOK');
      console.log('- Face Data (parsed):', requestData.faceData ? `${Array.isArray(requestData.faceData) ? requestData.faceData.length : 'VAR'} adet` : 'YOK (KAYBOLDU!)');
      console.log('- Selected Camp Days:', selectedCampDays);
      
      // Photo matching session oluştur (doğru veri modeli)
      console.log('Photo matching session oluşturuluyor...');
      const matchingSession = await storage.createPhotoMatchingSession({
        tcNumber: requestData.tcNumber,
        uploadedPhotoPath: null, // Daha sonra doldurulacak
        selectedFaceData: requestData.faceData,
        selectedModelIds: selectedCampDays || [], // Face model IDs
        timeoutAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 saat
        status: 'face_detection'
      });
      
      res.status(201).json({
        ...matchingSession,
        selectedModelCount: selectedCampDays?.length || 0,
        uploadedFilesCount: uploadedFilesCount || 0,
        downloadUrl: `/api/download-results/${matchingSession.tcNumber}`,
        message: 'Yüz eşleştirme işlemi başlatıldı. Sonuçlar hazırlandığında indirebilirsiniz.'
      });
    } catch (error) {
      console.error('Photo request creation error:', error);
      res.status(400).json({ message: 'Fotoğraf talebi oluşturulamadı' });
    }
  });

  // ZIP dosyası indirme endpoint'i
  app.get('/api/download-results/:tcNumber', async (req, res) => {
    try {
      const { tcNumber } = req.params;
      
      console.log('📦 ZIP indirme isteği:', tcNumber);
      
      // TC kimlik doğrulama
      if (!validateTCNumber(tcNumber)) {
        return res.status(400).json({ message: 'Geçersiz TC kimlik numarası' });
      }

      // Photo matching session kontrolü
      const matchingSession = await storage.getPhotoMatchingSessionByTc(tcNumber);
      if (!matchingSession) {
        return res.status(404).json({ message: 'Bu TC için yüz eşleştirme session\'ı bulunamadı' });
      }

      // Gerçek yüz eşleştirme implementasyonu
      const zip = new AdmZip();
      
      // Session'dan kullanıcının face embedding'ini al
      const userFaceData = matchingSession.selectedFaceData as any[];
      
      // selectedModelIds'i güvenli şekilde parse et
      let selectedModelIds: string[] = [];
      try {
        console.log('📋 selectedModelIds raw data:', matchingSession.selectedModelIds);
        console.log('📋 selectedModelIds type:', typeof matchingSession.selectedModelIds);
        
        if (typeof matchingSession.selectedModelIds === 'string') {
          selectedModelIds = JSON.parse(matchingSession.selectedModelIds);
        } else if (Array.isArray(matchingSession.selectedModelIds)) {
          selectedModelIds = matchingSession.selectedModelIds;
        } else {
          console.error('❌ selectedModelIds invalid format:', matchingSession.selectedModelIds);
          return res.status(400).json({ message: 'Geçersiz model seçimi formatı' });
        }
        console.log('✅ Parsed selectedModelIds:', selectedModelIds);
      } catch (parseError) {
        console.error('❌ JSON parse error for selectedModelIds:', parseError);
        console.error('❌ Raw data:', matchingSession.selectedModelIds);
        return res.status(400).json({ message: 'Model seçimi verisi parse edilemedi' });
      }
      
      let totalMatches = 0;
      let processedModels = 0;
      
      // Her seçilen model için eşleştirme yap
      for (const modelId of selectedModelIds) {
        try {
          const model = await storage.getFaceModel(modelId);
          if (!model || model.status !== 'ready') {
            console.log(`Model ${modelId} hazır değil, atlanıyor`);
            continue;
          }
          
          // Model dizinini kontrol et
          const modelPath = `./models/${model.name}`;
          if (!fs.existsSync(modelPath)) {
            console.log(`Model dizini bulunamadı: ${modelPath}`);
            continue;
          }
          
          // JSON veritabanını kontrol et (sadece JSON format destekleniyor)
          const jsonDbPath = path.join(modelPath, 'face_database.json');
          
          if (!fs.existsSync(jsonDbPath)) {
            console.log(`JSON face database bulunamadı: ${modelPath} - Güncel face training GUI kullanın`);
            continue;
          }
          
          console.log(`🎯 JSON veritabanı bulundu: ${jsonDbPath}`);
          
          // Database-based yüz eşleştirmesi yap (PKL dependency olmadan)
          try {
            // Face data kontrolü
            if (!userFaceData || userFaceData.length === 0 || !userFaceData[0]?.embedding) {
              console.log(`❌ ${model.name} için kullanıcı embedding'i bulunamadı`);
              return res.status(400).json({ 
                message: 'Yüz embedding\'i bulunamadı. Lütfen önce fotoğraf yükleyip yüz tespiti yapın.',
                model: model.name
              });
            }
            
            const userEmbedding = userFaceData[0].embedding;
            const threshold = 0.3; // Normal threshold (geri yükseltildi)
            
            console.log(`🎯 Database-based face matching başlatılıyor...`);
            console.log(`📐 User embedding boyutu: ${userEmbedding.length}`);
            console.log(`📐 User embedding örnek değerler:`, userEmbedding.slice(0, 5));
            console.log(`🎯 Threshold: ${threshold}`);
            
            // Model klasöründeki yardımcı JSON dosyalarını kontrol et
            let modelFaces: any[] = [];
            let dataSource = 'Database';
            
            // JSON veritabanını yükle
            try {
              const jsonData = JSON.parse(fs.readFileSync(jsonDbPath, 'utf8'));
              modelFaces = Object.entries(jsonData).map(([imagePath, faceData]: [string, any]) => ({
                imagePath,
                embedding: faceData.embedding || faceData.normed_embedding,
                ...faceData
              }));
              dataSource = 'JSON database';
              console.log(`✅ JSON database yüklendi: ${modelFaces.length} yüz`);
            } catch (jsonError) {
              console.log(`❌ JSON database okunamadı: ${jsonError}`);
            }
            
            // 2. Model'e ait database kayıtlarını kontrol et (future enhancement)
            if (modelFaces.length === 0) {
              // Burada gelecekte database'deki face records'ları alabiliriz
              console.log(`⚠️ ${model.name} için yüz verisi bulunamadı`);
            }
            
            let matches: any[] = [];
            
            if (modelFaces.length > 0) {
              // JavaScript cosine similarity ile eşleştirme yap
              let maxSimilarity = 0;
              let minSimilarity = 1;
              let similarityCount = 0;
              
              for (const face of modelFaces) {
                if (!face || !face.embedding) {
                  console.log('⚠️ Geçersiz face objesi veya embedding eksik, atlanıyor');
                  continue;
                }
                
                const similarity = calculateCosineSimilarity(userEmbedding, face.embedding);
                similarityCount++;
                
                // İstatistikler için
                if (similarity > maxSimilarity) maxSimilarity = similarity;
                if (similarity < minSimilarity) minSimilarity = similarity;
                
                // İlk 3 sonucu debug için göster
                if (similarityCount <= 3) {
                  console.log(`🔍 Debug similarity ${similarityCount}: ${face.imagePath} = ${similarity.toFixed(4)}`);
                  console.log(`   DB embedding örnek:`, face.embedding.slice(0, 5));
                }
                
                if (similarity >= threshold) {
                  matches.push({
                    image_path: face.imagePath,
                    similarity: similarity,
                    full_path: path.join(modelPath, face.imagePath)
                  });
                }
              }
              
              console.log(`📊 Similarity istatistikleri: Min: ${minSimilarity.toFixed(4)}, Max: ${maxSimilarity.toFixed(4)}, Kontrol edilen: ${similarityCount}`);
              
              // Benzerlik oranına göre sırala
              matches.sort((a, b) => b.similarity - a.similarity);
              
              console.log(`✅ JavaScript eşleştirmesi başarılı: ${matches.length} eşleşme`);
              
              // Eşleştirme sonuçlarını ZIP'e ekle
              const reportContent = `
Face Database Eşleştirme Raporu (JavaScript)
Model: ${model.name}
İşlem Tarihi: ${new Date().toLocaleDateString('tr-TR')}
Veri Kaynağı: ${dataSource}
Toplam Yüz Sayısı: ${modelFaces.length}
Threshold: ${threshold}
Algoritma: JavaScript Cosine Similarity
Toplam Eşleşme: ${matches.length}

EŞLEŞEN YÜZLER:
${matches.map((match: any, i: number) => 
  `${i+1}. ${match.image_path} - Similarity: ${match.similarity.toFixed(3)}`
).join('\n')}

⚡ Bu sonuçlar server-side JavaScript cosine similarity ile hesaplanmıştır.
⚡ PKL dosyası dependency'si olmadan çalışır.
`;
              
              zip.addFile(`${model.name}_face_matching_raporu.txt`, Buffer.from(reportContent, 'utf8'));
              
              // Eşleşen yüzlerin kopyalarını ekle (varsa)
              for (const match of matches.slice(0, 10)) { // İlk 10 eşleşme
                let imageName = match.image_path;
                
                // JSON key'den gerçek dosya adını çıkar (||face_X kısmını temizle)
                if (imageName.includes('||')) {
                  imageName = imageName.split('||')[0];
                }
                console.log(`🔍 Aranan resim: ${imageName}`);
                let imageFound = false;
                
                // Full path'i kontrol et
                if (match.full_path && fs.existsSync(match.full_path)) {
                  try {
                    const imageBuffer = fs.readFileSync(match.full_path);
                    const zipFileName = `eşleşen_${match.similarity.toFixed(3)}_${imageName}`;
                    zip.addFile(zipFileName, imageBuffer);
                    console.log(`📸 Eşleşen görsel eklendi: ${zipFileName}`);
                    imageFound = true;
                  } catch (readError) {
                    console.log(`❌ Resim okunamadı: ${match.full_path}`);
                  }
                }
                
                // Alternatif yolları dene (denemelik klasörü öncelikli)
                if (!imageFound) {
                  const possiblePaths = [
                    path.join(modelPath, 'denemelik', imageName), // İlk denemelik
                    path.join(modelPath, imageName),
                    path.join(modelPath, 'photos', imageName),
                    path.join(modelPath, 'images', imageName),
                    path.join('./public/uploads', imageName)
                  ];
                  
                  for (const possiblePath of possiblePaths) {
                    if (fs.existsSync(possiblePath)) {
                      try {
                        const imageBuffer = fs.readFileSync(possiblePath);
                        const zipFileName = `eşleşen_${match.similarity.toFixed(3)}_${imageName}`;
                        zip.addFile(zipFileName, imageBuffer);
                        console.log(`📸 Eşleşen görsel eklendi: ${zipFileName} (fallback)`);
                        imageFound = true;
                        break;
                      } catch (readError) {
                        console.log(`❌ Resim okunamadı: ${possiblePath}`);
                      }
                    }
                  }
                }
                
                if (!imageFound) {
                  console.log(`⚠️ Resim bulunamadı: ${imageName}`);
                }
              }
              
              totalMatches += matches.length;
            } else {
              console.log(`❌ ${model.name} için yüz verisi bulunamadı`);
              
              // No data raporunu ekle
              const noDataReport = `
Face Matching - Veri Bulunamadı
Model: ${model.name}
İşlem Tarihi: ${new Date().toLocaleDateString('tr-TR')}
Durum: Yüz verisi bulunamadı
Kontrol Edilenler:
- JSON database: ${fs.existsSync(jsonDbPath) ? 'VAR (okunamadı)' : 'YOK'}
- Sistem: JSON-only format (PKL desteği kaldırıldı)

Bu model için yüz eşleştirmesi yapılamadı.
`;
              zip.addFile(`${model.name}_VERİ_BULUNAMADI.txt`, Buffer.from(noDataReport, 'utf8'));
            }
            
          } catch (matchingError) {
            console.error(`❌ Face matching hatası (${model.name}):`, matchingError);
            
            // Matching hatası raporunu ekle
            const matchingErrorReport = `
Face Matching İstisna Hatası
Model: ${model.name}
İşlem Tarihi: ${new Date().toLocaleDateString('tr-TR')}
Hata Detayı: ${matchingError instanceof Error ? matchingError.message : String(matchingError)}

Bu hata yüz eşleştirme sırasında oluştu.
`;
            zip.addFile(`${model.name}_MATCHING_HATA.txt`, Buffer.from(matchingErrorReport, 'utf8'));
            processedModels++;
            continue; // Fallback'e geçme, bir sonraki modele geç
          }
          
        } catch (error) {
          console.error(`❌ Model ${modelId} işleme hatası:`, error);
        }
        
        processedModels++;
      }
      
      // Özet oluştur  
      console.log(`📊 İşlem tamamlandı: ${processedModels} model işlendi, ${totalMatches} toplam eşleşme`);
      
      // Özet dosyası ekle
      zip.addFile('EŞLEŞTIRME_ÖZET.txt', Buffer.from(`
🔍 YÜZ EŞLEŞTIRME RAPORU
========================

TC Kimlik: ${tcNumber}
İşlem Tarihi: ${new Date().toLocaleDateString('tr-TR')}
İşlem Saati: ${new Date().toLocaleTimeString('tr-TR')}

📊 İşlem Detayları:
- Seçilen Model Sayısı: ${selectedModelIds.length}
- İşlenen Model Sayısı: ${processedModels}
- Toplam Bulunan Fotoğraf: ${totalMatches}

🎯 İşlenen Modeller:
${selectedModelIds.map((id: string, i: number) => `${i+1}. Model ID: ${id}`).join('\n')}

⚠️  Not: Gerçek fotoğraf eşleştirme için Python face matcher sistemi entegrasyonu gereklidir.
Bu dosyalar şu anda yüz eşleştirme sisteminin çalıştığını doğrular.
      `, 'utf8'));

      // ZIP'i buffer olarak al
      const zipBuffer = zip.toBuffer();
      
      // ZIP dosyasını response olarak gönder
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="fotograf_${tcNumber}_${new Date().toISOString().split('T')[0]}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);
      
      console.log('✅ ZIP dosyası gönderiliyor:', zipBuffer.length, 'bytes');
      res.send(zipBuffer);
    } catch (error) {
      console.error('ZIP download error:', error);
      res.status(500).json({ message: 'ZIP dosyası oluşturulamadı' });
    }
  });

  // TC numarası ile talep kontrolü
  app.get('/api/photo-requests/check/:tcNumber', async (req, res) => {
    try {
      const { tcNumber } = req.params;
      
      if (!validateTCNumber(tcNumber)) {
        return res.status(400).json({ message: 'Geçersiz TC kimlik numarası' });
      }
      
      const existingRequest = await storage.getPhotoRequestByTc(tcNumber);
      
      if (existingRequest) {
        res.json({ 
          exists: true, 
          request: existingRequest 
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error) {
      console.error('Photo request check error:', error);
      res.status(500).json({ message: 'Talep kontrolü yapılamadı' });
    }
  });

  // Referans fotoğraf yükleme
  app.post('/api/photo-requests/:id/upload', async (req, res) => {
    try {
      const { id } = req.params;
      const { referencePhotoURL } = req.body;
      
      if (!referencePhotoURL) {
        return res.status(400).json({ message: 'Referans fotoğraf URL gerekli' });
      }
      
      // PhotoRequest'i güncelle
      const updatedRequest = await storage.updatePhotoRequest(id, {
        referencePhotoPath: referencePhotoURL,
        status: 'pending'
      });
      
      // İşlem kuyruğuna ekle
      const queuePosition = await storage.getQueueStatus().then(queue => queue.length + 1);
      await storage.addToProcessingQueue({
        photoRequestId: id,
        queuePosition,
        progress: 0,
        currentStep: 'face_detection'
      });
      
      // Mock yüz tespit verisi (gerçek uygulamada face-api.js kullanılacak)
      setTimeout(async () => {
        try {
          // Mock tespit edilen yüzler
          const mockFaces = [
            {
              photoRequestId: id,
              faceImagePath: 'mock/face1.jpg',
              confidence: '0.95',
              quality: 'good' as const,
              boundingBox: { x: 100, y: 100, width: 150, height: 150 },
              landmarks: {},
              embeddings: {},
              isSelected: false
            },
            {
              photoRequestId: id,
              faceImagePath: 'mock/face2.jpg',
              confidence: '0.87',
              quality: 'good' as const,
              boundingBox: { x: 200, y: 150, width: 140, height: 140 },
              landmarks: {},
              embeddings: {},
              isSelected: false
            }
          ];
          
          // Tespit edilen yüzleri kaydet
          for (const face of mockFaces) {
            await storage.createDetectedFace(face);
          }
          
          // Request'i güncelle
          await storage.updatePhotoRequest(id, {
            status: 'pending' // Yüz seçimi için bekliyor
          });
          
        } catch (error) {
          console.error('Mock face detection error:', error);
          await storage.updatePhotoRequest(id, {
            status: 'failed',
            errorMessage: 'Yüz tespit işlemi başarısız'
          });
        }
      }, 2000); // 2 saniye sonra mock sonuç
      
      res.json({ message: 'Fotoğraf yüklendi, yüz tespit işlemi başlatıldı' });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(400).json({ message: 'Fotoğraf yüklenemedi' });
    }
  });

  // Tespit edilen yüzleri getirme
  app.get('/api/photo-requests/:id/faces', async (req, res) => {
    try {
      const { id } = req.params;
      const faces = await storage.getDetectedFacesByRequest(id);
      res.json(faces);
    } catch (error) {
      console.error('Get faces error:', error);
      res.status(500).json({ message: 'Yüzler getirilemedi' });
    }
  });

  // Yüz seçimi
  app.post('/api/photo-requests/:id/select-face', async (req, res) => {
    try {
      const { id } = req.params;
      const { faceId } = req.body;
      
      if (!faceId) {
        return res.status(400).json({ message: 'Yüz ID gerekli' });
      }
      
      await storage.selectDetectedFace(id, faceId);
      
      // Mock eşleşme işlemi
      setTimeout(async () => {
        try {
          // Mock eşleşen fotoğraflar
          const mockMatches = [
            {
              photoRequestId: id,
              photoDatabaseId: 'mock-photo-1',
              similarityScore: '0.92',
              matchedFaceBox: { x: 50, y: 60, width: 100, height: 100 },
              isEmailSent: false
            },
            {
              photoRequestId: id,
              photoDatabaseId: 'mock-photo-2',
              similarityScore: '0.88',
              matchedFaceBox: { x: 80, y: 90, width: 110, height: 110 },
              isEmailSent: false
            }
          ];
          
          // Eşleşmeleri kaydet
          for (const match of mockMatches) {
            await storage.createPhotoMatch(match);
          }
          
          // Request'i tamamlandı olarak işaretle
          await storage.updatePhotoRequest(id, {
            status: 'completed',
            matchedPhotosCount: mockMatches.length
          });
          
        } catch (error) {
          console.error('Mock matching error:', error);
          await storage.updatePhotoRequest(id, {
            status: 'failed',
            errorMessage: 'Eşleşme işlemi başarısız'
          });
        }
      }, 3000); // 3 saniye sonra mock eşleşme
      
      res.json({ message: 'Yüz seçildi, eşleşme işlemi başlatıldı' });
    } catch (error) {
      console.error('Face selection error:', error);
      res.status(400).json({ message: 'Yüz seçilemedi' });
    }
  });

  // Tüm fotoğraf talepleri (Admin)
  app.get('/api/photo-requests', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const requests = await storage.getAllPhotoRequests();
      res.json(requests);
    } catch (error) {
      console.error('Get photo requests error:', error);
      res.status(500).json({ message: 'Fotoğraf talepleri getirilemedi' });
    }
  });

  // İşlem kuyruğu durumu (Admin)
  app.get('/api/photo-requests/queue', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const queueStatus = await storage.getQueueStatus();
      res.json(queueStatus);
    } catch (error) {
      console.error('Get queue status error:', error);
      res.status(500).json({ message: 'Kuyruk durumu getirilemedi' });
    }
  });

  // Camp days endpoints
  app.get('/api/camp-days', async (req, res) => {
    try {
      const campDays = await storage.getAllCampDays();
      res.json(campDays);
    } catch (error) {
      console.error('Get camp days error:', error);
      res.status(500).json({ message: 'Kamp günleri alınırken hata oluştu' });
    }
  });

  app.post('/api/camp-days', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertCampDaySchema.parse(req.body);
      const campDay = await storage.createCampDay(validatedData);
      res.status(201).json(campDay);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Geçersiz veri',
          errors: error.errors 
        });
      }
      console.error('Create camp day error:', error);
      res.status(500).json({ message: 'Kamp günü oluşturulurken hata oluştu' });
    }
  });

  app.put('/api/camp-days/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertCampDaySchema.partial().parse(req.body);
      const campDay = await storage.updateCampDay(id, validatedData);
      res.json(campDay);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Geçersiz veri',
          errors: error.errors 
        });
      }
      console.error('Update camp day error:', error);
      res.status(500).json({ message: 'Kamp günü güncellenirken hata oluştu' });
    }
  });

  app.delete('/api/camp-days/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCampDay(id);
      res.json({ message: 'Kamp günü silindi' });
    } catch (error) {
      console.error('Delete camp day error:', error);
      res.status(500).json({ message: 'Kamp günü silinirken hata oluştu' });
    }
  });



  // Mock görsel servis (gerçek uygulamada object storage kullanılacak)
  app.get('/api/images/:imagePath', (req, res) => {
    const { imagePath } = req.params;
    // Mock image response
    res.status(404).json({ message: 'Görsel bulunamadı (mock mode)' });
  });
  // Google Drive Download Helper Functions
  function extractGoogleDriveFileId(url: string): string | null {
    // Google Drive link formatları:
    // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // https://drive.google.com/open?id=FILE_ID
    // https://drive.google.com/uc?id=FILE_ID
    
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  async function downloadFromGoogleDrive(fileId: string, outputPath: string): Promise<void> {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Google Drive'dan indirme hatası: ${(error as Error).message}`);
    }
  }

  async function extractZipAndMoveData(zipPath: string, currentModelName: string): Promise<{ 
    faceCount: number; 
    trainingDataPath: string;
    modelInfo?: {
      name: string;
      description: string;
      algorithm: string;
      threshold: number;
      created_at: string;
      source_folder: string;
    };
  }> {
    const tempDir = path.join('/tmp', `extract_${Date.now()}`);
    
    // Geçici dizin oluştur
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    let modelInfo: any = undefined;
    let finalModelName = currentModelName; // Fallback olarak mevcut isim
    
    try {
      // ZIP dosyasını aç
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tempDir, true);
      console.log(`ZIP extracted to: ${tempDir}`);
      
      // face_training_gui.py'nin yeni yapısına uygun model klasörünü bul
      // Artık models/model_adı/ formatında direkt oluşturuyor
      const modelsDir = path.join(tempDir, 'models');
      let modelDir = '';
      
      if (fs.existsSync(modelsDir)) {
        // Yeni yapı: models/model_adı/
        const modelFolders = fs.readdirSync(modelsDir);
        if (modelFolders.length > 0) {
          modelDir = path.join(modelsDir, modelFolders[0]);
          finalModelName = modelFolders[0]; // Gerçek model adını al
          console.log(`New model structure found: models/${finalModelName}/`);
        } else {
          throw new Error('Models klasöründe model bulunamadı');
        }
      } else {
        // Eski yapı için backward compatibility: training_package/
        const trainingPackageDir = path.join(tempDir, 'training_package');
        if (fs.existsSync(trainingPackageDir)) {
          modelDir = trainingPackageDir;
          console.log('Old training_package structure found (backward compatible)');
        } else {
          throw new Error('ZIP dosyasında ne models/ ne de training_package/ klasörü bulunamadı');
        }
      }
      
      // model_info.json dosyasını oku (varsa)
      const modelInfoPath = path.join(modelDir, 'model_info.json');
      if (fs.existsSync(modelInfoPath)) {
        try {
          const jsonContent = fs.readFileSync(modelInfoPath, 'utf-8');
          modelInfo = JSON.parse(jsonContent);
          finalModelName = modelInfo.name; // JSON'dan gerçek model adını al
          console.log(`Model JSON metadata found: ${modelInfo.name} - ${modelInfo.description}`);
        } catch (jsonError) {
          console.warn('model_info.json okunamadı, devam ediliyor:', jsonError);
        }
      } else {
        console.log('model_info.json bulunamadı, varsayılan bilgiler kullanılacak');
      }
      
      // face_database.json dosyasını kontrol et (artık direkt JSON oluşuyor)
      const jsonDbPath = path.join(modelDir, 'face_database.json');
      
      if (!fs.existsSync(jsonDbPath)) {
        throw new Error('face_database.json dosyası bulunamadı - Güncel face training GUI kullanın');
      }
      
      console.log('✅ JSON veritabanı dosyası bulundu (PKL dependency gerekmez)');
      
      // Hedef dizin oluştur (gerçek model adıyla)
      const targetDir = path.join('./models', finalModelName);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Tüm dosya ve klasörleri hedef dizine kopyala (recursive)
      const copyRecursive = (source: string, destination: string) => {
        const stats = fs.statSync(source);
        
        if (stats.isDirectory()) {
          // Klasör ise recursive kopyala
          if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
          }
          const files = fs.readdirSync(source);
          for (const file of files) {
            copyRecursive(
              path.join(source, file),
              path.join(destination, file)
            );
          }
          console.log(`Copied directory: ${path.basename(source)}`);
        } else {
          // Dosya ise direkt kopyala
          fs.copyFileSync(source, destination);
          console.log(`Copied file: ${path.basename(source)}`);
        }
      };
      
      const files = fs.readdirSync(modelDir);
      for (const file of files) {
        const sourcePath = path.join(modelDir, file);
        const targetPath = path.join(targetDir, file);
        copyRecursive(sourcePath, targetPath);
      }
      
      // Yüz sayısını hesapla (tüm klasörlerde recursive olarak)
      const countImagesRecursive = (dir: string): number => {
        let count = 0;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            count += countImagesRecursive(fullPath);
          } else if (item.match(/\.(jpg|jpeg|png|bmp|tiff)$/i)) {
            count++;
          }
        }
        return count;
      };
      
      const faceCount = countImagesRecursive(targetDir);
      
      // Geçici dosyaları temizle
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
      
      return {
        faceCount,
        trainingDataPath: targetDir,
        modelInfo: modelInfo ? {
          name: finalModelName,
          description: modelInfo.description || 'Model açıklaması yok',
          algorithm: modelInfo.algorithm || 'InsightFace Buffalo_L',
          threshold: modelInfo.threshold || 0.5,
          created_at: modelInfo.created_at || new Date().toISOString(),
          source_folder: modelInfo.source_folder || 'Bilinmiyor'
        } : undefined
      };
    } catch (error) {
      // Hata durumunda geçici dosyaları temizle
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  // Face Models API Endpoints
  // Photo matching routes
  app.post('/api/photo-matching/start-session', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { tcNumber, selectedModelIds } = req.body;
      
      if (!tcNumber || !selectedModelIds || selectedModelIds.length === 0) {
        return res.status(400).json({ message: 'TC numarası ve en az bir model seçilmelidir' });
      }
      
      // Check for existing active session within timeout
      const existingSession = await storage.getActivePhotoMatchingSession(tcNumber);
      if (existingSession) {
        return res.json({
          sessionId: existingSession.id,
          status: existingSession.status,
          progress: existingSession.progressPercentage,
          currentStep: existingSession.currentStep,
          timeoutAt: existingSession.timeoutAt,
        });
      }
      
      // Create new session
      const timeoutHours = await storage.getSystemSetting('photo_matching_timeout_hours', '3');
      const timeoutAt = new Date(Date.now() + parseInt(timeoutHours) * 60 * 60 * 1000);
      
      const session = await storage.createPhotoMatchingSession({
        tcNumber,
        uploadedPhotoPath: '', // Will be updated when photo is uploaded
        selectedModelIds: JSON.stringify(selectedModelIds),
        timeoutAt,
      });
      
      res.json({
        sessionId: session.id,
        status: session.status,
        uploadUrl: `/api/photo-matching/${session.id}/upload`,
      });
    } catch (error) {
      console.error('Error starting photo matching session:', error);
      res.status(500).json({ message: 'Eşleştirme oturumu başlatılamadı' });
    }
  });

  app.get('/api/photo-matching/:sessionId/status', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getPhotoMatchingSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Oturum bulunamadı' });
      }
      
      const results = await storage.getFaceModelMatchingResults(sessionId);
      
      res.json({
        sessionId: session.id,
        status: session.status,
        progress: session.progressPercentage,
        currentStep: session.currentStep,
        queuePosition: session.queuePosition,
        results: results.map(r => ({
          modelId: r.faceModelId,
          modelName: `Model ${r.faceModelId}`,
          totalMatches: r.totalMatches,
          isZipReady: r.isZipReady,
          canDownload: r.isZipReady && !r.downloadedAt,
        })),
        timeoutAt: session.timeoutAt,
        errorMessage: session.errorMessage,
      });
    } catch (error) {
      console.error('Error getting session status:', error);
      res.status(500).json({ message: 'Durum alınamadı' });
    }
  });

  app.get('/api/photo-matching/download/:sessionId/:modelId', requireAuth, async (req, res) => {
    try {
      const { sessionId, modelId } = req.params;
      
      const result = await storage.getFaceModelMatchingResult(sessionId, modelId);
      if (!result || !result.isZipReady) {
        return res.status(404).json({ message: 'İndirme dosyası hazır değil' });
      }
      
      // TODO: Implement actual file download
      // For now, just mark as downloaded
      await storage.markResultAsDownloaded(result.id);
      
      res.json({ 
        message: 'İndirme başladı',
        downloadUrl: `/downloads/${result.zipFilePath}` 
      });
    } catch (error) {
      console.error('Error downloading results:', error);
      res.status(500).json({ message: 'İndirme başlatılamadı' });
    }
  });

  app.get('/api/face-models', async (req, res) => {
    try {
      const models = await storage.getAllFaceModels();
      res.json(models);
    } catch (error) {
      console.error('Error fetching face models:', error);
      res.status(500).json({ message: 'Modeller getirilirken hata oluştu' });
    }
  });

  app.post('/api/face-models', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertFaceModelSchema.parse(req.body);
      
      // Google Drive linkini doğrula
      const fileId = extractGoogleDriveFileId(validatedData.googleDriveLink);
      if (!fileId) {
        return res.status(400).json({ message: 'Geçersiz Google Drive linki' });
      }
      
      // Geçici model oluştur - bilgiler ZIP işlenirken güncellenecek
      const model = await storage.createFaceModel({
        name: `Model-${Date.now()}`, // Geçici ad, JSON'dan güncellenecek
        description: 'Model bilgileri yükleniyor...',
        googleDriveLink: validatedData.googleDriveLink,
        status: 'pending', // Manuel indirme için pending başlat
        downloadProgress: 0,
        createdBy: req.user!.id,
        algorithm: 'InsightFace Buffalo_L', // Default değer
        threshold: 0.5 // Default değer
      } as any);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'create_user', // Using existing action type
        details: `Yeni yüz tanıma modeli oluşturma başladı (ZIP'ten bilgiler okunacak)`,
        metadata: { modelId: model.id, googleDriveLink: validatedData.googleDriveLink },
        ipAddress: req.ip,
      });
      
      console.log(`Model created with temporary name: ${model.name}, ready for manual download and JSON processing`);
      
      res.status(201).json(model);
    } catch (error: any) {
      console.error('Error creating face model:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: 'Geçersiz Google Drive linki giriniz', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Model oluşturulurken hata oluştu' });
      }
    }
  });

  app.post('/api/face-models/:id/download', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      console.log(`Download request for model: ${id}`);
      
      const model = await storage.getFaceModel(id);
      
      if (!model) {
        console.log(`Model not found: ${id}`);
        return res.status(404).json({ message: 'Model bulunamadı' });
      }
      
      console.log(`Model status: ${model.status}, Google Drive link: ${model.googleDriveLink}`);
      
      if (model.status === 'downloading' || model.status === 'extracting') {
        console.log(`Model already processing: ${model.status}`);
        return res.status(400).json({ message: 'Model zaten işleniyor' });
      }
      
      if (model.status === 'ready') {
        console.log(`Model already ready: ${model.status}`);
        return res.status(400).json({ message: 'Model zaten hazır durumda' });
      }
      
      // Google Drive link kontrolü
      const fileId = extractGoogleDriveFileId(model.googleDriveLink);
      console.log(`Extracted file ID: ${fileId} from link: ${model.googleDriveLink}`);
      
      if (!fileId) {
        console.log(`Invalid Google Drive link: ${model.googleDriveLink}`);
        await storage.updateFaceModel(id, {
          status: 'error',
          errorMessage: 'Geçersiz Google Drive linki'
        });
        return res.status(400).json({ message: 'Geçersiz Google Drive linki' });
      }
      
      // İndirme işlemini başlat
      await storage.updateFaceModel(id, {
        status: 'downloading',
        downloadProgress: 0,
        errorMessage: null
      });
      
      console.log(`Starting download for model: ${model.name}, file ID: ${fileId}`);
      
      // Background process olarak çalıştır
      (async () => {
        try {
          const tempZipPath = path.join('/tmp', `${model.name}_${Date.now()}.zip`);
          console.log(`Starting Google Drive download to: ${tempZipPath}`);
          
          // İndirme
          await downloadFromGoogleDrive(fileId, tempZipPath);
          console.log(`Download completed, file size: ${fs.statSync(tempZipPath).size} bytes`);
          
          await storage.updateFaceModel(id, {
            status: 'extracting',
            downloadProgress: 100
          });
          console.log(`Model status updated to extracting`);
          
          // Açma ve taşıma - JSON metadata ile
          const { faceCount, trainingDataPath, modelInfo } = await extractZipAndMoveData(tempZipPath, model.name);
          
          // Model bilgilerini JSON'dan güncelle
          const updateData: any = {
            status: 'ready',
            serverPath: trainingDataPath,
            faceCount,
            trainingDataPath,
            processedAt: new Date(),
            errorMessage: null
          };
          
          // JSON'dan okunan bilgiler varsa model'i güncelle
          if (modelInfo) {
            updateData.name = modelInfo.name;
            updateData.description = modelInfo.description;
            updateData.algorithm = modelInfo.algorithm;
            updateData.threshold = modelInfo.threshold;
            console.log(`Model JSON metadata applied: ${modelInfo.name} - ${modelInfo.description}`);
          }
          
          await storage.updateFaceModel(id, updateData);
          
          console.log(`Face model processed: ${modelInfo?.name || model.name} (${faceCount} faces)`);
        } catch (error) {
          console.error(`Error processing face model ${model.name}:`, error);
          await storage.updateFaceModel(id, {
            status: 'error',
            errorMessage: (error as Error).message
          });
        }
      })();
      
      res.json({ message: 'İndirme işlemi başlatıldı' });
    } catch (error) {
      console.error('Error starting face model download:', error);
      res.status(500).json({ message: 'İndirme başlatılırken hata oluştu' });
    }
  });

  app.delete('/api/face-models/:id', requireAuth, requireRole(['genelsekreterlik']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const model = await storage.getFaceModel(id);
      
      if (!model) {
        return res.status(404).json({ message: 'Model bulunamadı' });
      }
      
      // Sunucudaki dosyaları temizle
      if (model.serverPath && fs.existsSync(model.serverPath)) {
        fs.rmSync(model.serverPath, { recursive: true, force: true });
      }
      
      await storage.deleteFaceModel(id);
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        action: 'delete_user', // Using existing action type
        details: `Yüz tanıma modeli silindi: ${model.name}`,
        metadata: { modelId: id },
        ipAddress: req.ip,
      });
      
      res.json({ message: 'Model başarıyla silindi' });
    } catch (error) {
      console.error('Error deleting face model:', error);
      res.status(500).json({ message: 'Model silinirken hata oluştu' });
    }
  });






  const httpServer = createServer(app);
  return httpServer;
}
