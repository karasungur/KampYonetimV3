import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireRole, generateToken, comparePassword, hashPassword, type AuthenticatedRequest } from "./auth";
import { insertUserSchema, insertQuestionSchema, insertAnswerSchema, insertFeedbackSchema, insertProgramEventSchema, insertUploadedFileSchema, insertPageLayoutSchema, insertPageElementSchema, insertPhotoRequestSchema, insertDetectedFaceSchema, insertPhotoDatabaseSchema, insertPhotoMatchSchema, insertProcessingQueueSchema, insertCampDaySchema, insertPhotoRequestDaySchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

// Object Storage için gerekli importlar
let ObjectStorageService: any;
try {
  // Object storage şu an mock olarak çalışıyor
  ObjectStorageService = null;
} catch (error) {
  console.warn('Object storage not available:', (error as Error).message);
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
  // Genel API rate limiting (auth hariç)
  app.use('/api/', (req, res, next) => {
    // Auth rotalarına rate limiting uygulanmasın (zaten kendi limitleri var)
    if (req.path.startsWith('/api/auth/')) {
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

  // Python GUI için photo request endpoint
  app.get('/api/python/photo-requests', async (req, res) => {
    try {
      // Basit güvenlik kontrolü - sadece localhost'tan
      const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
      if (clientIP !== '127.0.0.1' && clientIP !== '::1' && !clientIP.includes('127.0.0.1')) {
        // localhost olmayan IP'ler için temel auth kontrol
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== 'Bearer python-gui-token') {
          return res.status(401).json({ message: 'Unauthorized' });
        }
      }
      
      const photoRequests = await storage.getAllPhotoRequests();
      res.json(photoRequests);
    } catch (error) {
      console.error('Python photo requests error:', error);
      res.status(500).json({ message: 'Photo requests alınamadı' });
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
      const answers = await storage.getAllAnswers();
      
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
      const users = await storage.getAllUsers();
      
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

  // Object Storage upload URL endpoint (Development)
  app.post('/api/objects/upload', async (req, res) => {
    try {
      // Development mode için geçici upload URL
      const uploadURL = `${req.protocol}://${req.get('host')}/api/upload-temp/${nanoid()}`;
      res.json({ uploadURL });
    } catch (error) {
      console.error('Upload URL error:', error);
      res.status(500).json({ error: 'Upload URL alınamadı' });
    }
  });

  // Geçici upload endpoint (Development)
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
        faceData: req.body.faceData, // Web'den gelen yüz embedding verileri
        status: 'pending'
      });
      
      // Debug: Parse sonrası
      console.log('🔍 requestData.faceData:', requestData.faceData ? 'VAR' : 'YOK');
      
      // TC kimlik doğrulama
      if (!validateTCNumber(requestData.tcNumber)) {
        return res.status(400).json({ message: 'Geçersiz TC kimlik numarası' });
      }
      
      // Önceki talep kontrolü
      const existingRequest = await storage.getPhotoRequestByTc(requestData.tcNumber);
      if (existingRequest) {
        return res.status(400).json({ 
          message: 'Bu TC kimlik numarası için zaten bir talep mevcut',
          existingRequest 
        });
      }
      
      // Debug: Gelen veriyi kontrol et
      console.log('📥 Web\'den gelen fotoğraf isteği:');
      console.log('- TC:', requestData.tcNumber);
      console.log('- Email:', requestData.email);
      console.log('- Face Data (raw):', req.body.faceData ? `${Array.isArray(req.body.faceData) ? req.body.faceData.length : 'VAR'} adet` : 'YOK');
      console.log('- Face Data (parsed):', requestData.faceData ? `${Array.isArray(requestData.faceData) ? requestData.faceData.length : 'VAR'} adet` : 'YOK (KAYBOLDU!)');
      console.log('- Selected Camp Days:', selectedCampDays);
      
      // İsteği veritabanına kaydet (Python GUI ayrı çalışacak)
      console.log('Fotoğraf isteği veritabanına kaydediliyor...');
      const photoRequest = await storage.createPhotoRequest(requestData);
      
      // Seçilen kamp günlerini kaydet
      if (selectedCampDays && Array.isArray(selectedCampDays) && selectedCampDays.length > 0) {
        for (const campDayId of selectedCampDays) {
          await storage.createPhotoRequestDay({
            photoRequestId: photoRequest.id,
            campDayId: campDayId
          });
        }
      }
      
      res.status(201).json({
        ...photoRequest,
        selectedCampDaysCount: selectedCampDays?.length || 0,
        uploadedFilesCount: uploadedFilesCount || 0,
        message: 'İsteğiniz başarıyla kaydedildi. Python GUI uygulamasından işlenecektir.'
      });
    } catch (error) {
      console.error('Photo request creation error:', error);
      res.status(400).json({ message: 'Fotoğraf talebi oluşturulamadı' });
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
        status: 'processing'
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

  // Python'dan model senkronizasyonu endpoint'i
  app.post('/api/python/sync-models', async (req, res) => {
    try {
      const { models } = req.body;
      
      if (!models || !Array.isArray(models)) {
        return res.status(400).json({ message: 'Geçersiz model verisi' });
      }

      // Önce mevcut kamp günlerini temizle (sadece Python'dan gelenler kalacak)
      await storage.deleteAllCampDays();

      // Yeni modelleri kamp günü olarak kaydet
      for (const model of models) {
        const campDayData = {
          id: model.id,
          dayName: model.name,
          dayDate: new Date(model.trainedAt),
          modelPath: `./models/${model.id}/face_database.pkl`,
          modelStatus: 'trained' as const,
          photoCount: 0, // Python'dan gelmedi ise varsayılan
          faceCount: model.faceCount || 0,
          lastTrainedAt: new Date(model.trainedAt),
          isActive: true
        };

        await storage.createCampDay(campDayData);
      }

      res.json({ 
        message: 'Modeller başarıyla senkronize edildi',
        syncedCount: models.length 
      });
      
    } catch (error) {
      console.error('Model sync error:', error);
      res.status(500).json({ message: 'Model senkronizasyonu başarısız' });
    }
  });

  // Mock görsel servis (gerçek uygulamada object storage kullanılacak)
  app.get('/api/images/:imagePath', (req, res) => {
    const { imagePath } = req.params;
    // Mock image response
    res.status(404).json({ message: 'Görsel bulunamadı (mock mode)' });
  });

  // Python API Integration Endpoints
  // Python tarafından çağrılan endpoint'ler
  app.post('/api/process-photo-request', async (req, res) => {
    try {
      const { tcNumber, email, referencePhotos, selectedCampDays } = req.body;
      
      if (!tcNumber || !email || !selectedCampDays?.length) {
        return res.status(400).json({ error: 'Eksik parametreler' });
      }
      
      // Photo request'i veritabanına kaydet
      const photoRequest = await storage.createPhotoRequest({
        tcNumber,
        email,
        status: 'processing'
      });
      
      // Selected camp days'i kaydet
      for (const campDayId of selectedCampDays) {
        await storage.createPhotoRequestDay({
          photoRequestId: photoRequest.id,
          campDayId
        });
      }
      
      res.json({ 
        message: 'İstek başarıyla alındı',
        requestId: photoRequest.id,
        tcNumber 
      });
      
    } catch (error) {
      console.error('Process photo request error:', error);
      res.status(500).json({ error: 'İstek işlenirken hata oluştu' });
    }
  });

  app.get('/api/request-status/:tcNumber', async (req, res) => {
    try {
      const { tcNumber } = req.params;
      
      // Son photo request'i bul
      const photoRequest = await storage.getPhotoRequestByTc(tcNumber);
      
      if (!photoRequest) {
        return res.status(404).json({ status: 'not_found' });
      }
      
      res.json({
        status: photoRequest.status,
        progress: 0, // Progress buraya eklenmeli
        startTime: photoRequest.createdAt,
        message: photoRequest.errorMessage || ''
      });
      
    } catch (error) {
      console.error('Get request status error:', error);
      res.status(500).json({ error: 'Durum sorgulanırken hata oluştu' });
    }
  });

  app.post('/api/update-request-status', async (req, res) => {
    try {
      const { tcNumber, status, progress, message } = req.body;
      
      if (!tcNumber) {
        return res.status(400).json({ error: 'TC number gerekli' });
      }
      
      // Son photo request'i güncelle
      const photoRequest = await storage.getPhotoRequestByTc(tcNumber);
      
      if (photoRequest) {
        await storage.updatePhotoRequest(photoRequest.id, {
          status,
          errorMessage: message
        });
      }
      
      res.json({ message: 'Durum güncellendi' });
      
    } catch (error) {
      console.error('Update request status error:', error);
      res.status(500).json({ error: 'Durum güncellenirken hata oluştu' });
    }
  });

  // Python API için özel endpoint'ler (authentication-free)
  // Python yüz tanıma servisinin API durumunu kontrol etmesi için
  app.get('/api/python/health', async (req, res) => {
    try {
      const queueItems = await storage.getQueueStatus();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        queueSize: queueItems.length,
        processing: queueItems.filter(item => item.startedAt && !item.completedAt).length
      });
    } catch (error) {
      console.error('Python health check error:', error);
      res.status(500).json({ 
        status: 'error',
        message: 'Health check failed'
      });
    }
  });

  // Python servisinin işlem tamamlandığını bildirmesi için
  app.post('/api/python/photo-request/:tcNumber/complete', async (req, res) => {
    try {
      const { tcNumber } = req.params;
      const { success, message, matchCount } = req.body;

      console.log(`Python API: Photo request completed for TC: ${tcNumber}, Success: ${success}, Matches: ${matchCount}`);

      // İsteği veritabanında güncelle
      const photoRequest = await storage.getPhotoRequestByTc(tcNumber);
      if (photoRequest) {
        await storage.updatePhotoRequest(photoRequest.id, {
          status: success ? 'completed' : 'failed',
          errorMessage: success ? null : (message || 'İşlem sırasında hata oluştu')
        });
      }

      res.json({ 
        message: 'Status updated successfully',
        tcNumber 
      });
    } catch (error) {
      console.error('Python complete request error:', error);
      res.status(500).json({ 
        error: 'Failed to update request status' 
      });
    }
  });

  // Python servisinin yeni işlemler alması için
  app.get('/api/python/next-request', async (req, res) => {
    try {
      const nextQueueItem = await storage.getNextInQueue();
      if (nextQueueItem) {
        // İsteği işleme al
        await storage.updateQueueProgress(nextQueueItem.id, 0, 'Python servisi tarafından başlatılıyor');
        
        // Photo request bilgilerini de al
        const photoRequest = await storage.getPhotoRequest(nextQueueItem.photoRequestId);
        
        res.json({
          queueId: nextQueueItem.id,
          photoRequest: photoRequest
        });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error('Get next request error:', error);
      res.status(500).json({ error: 'Failed to get next request' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
