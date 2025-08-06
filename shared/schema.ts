import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['genelbaskan', 'genelsekreterlik', 'moderator']);
export const questionTypeEnum = pgEnum('question_type', ['general', 'specific']);
export const logActionEnum = pgEnum('log_action', ['login', 'logout', 'create_question', 'edit_question', 'delete_question', 'create_answer', 'edit_answer', 'delete_answer', 'create_user', 'edit_user', 'delete_user', 'send_feedback', 'import_users']);
export const elementTypeEnum = pgEnum('element_type', ['text', 'button', 'logo', 'slogan']);
export const photoRequestStatusEnum = pgEnum('photo_request_status', ['pending', 'face_detection', 'face_selection', 'queued', 'matching', 'completed', 'failed']);
export const faceQualityEnum = pgEnum('face_quality', ['good', 'poor', 'blurry', 'profile']);
export const faceModelStatusEnum = pgEnum('face_model_status', ['pending', 'downloading', 'extracting', 'ready', 'error']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  tcNumber: varchar("tc_number", { length: 11 }).notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default('moderator'),
  tableNumber: integer("table_number"),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tables (masa) for organizing moderators
export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull().unique(),
  name: varchar("name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Questions
export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  type: questionTypeEnum("type").notNull().default('general'),
  assignedTables: jsonb("assigned_tables"), // Array of table numbers for specific questions
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Answers/Responses
export const answers = pgTable("answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => questions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tableNumber: integer("table_number").notNull(),
  text: text("text").notNull(),
  orderIndex: integer("order_index").notNull().default(1), // For multiple answers per question
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Feedback from moderators to genelsekreterlik
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => questions.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // moderator who sent feedback
  message: text("message").notNull(),
  response: text("response"), // Response from genelsekreterlik
  respondedBy: varchar("responded_by").references(() => users.id), // who responded
  respondedAt: timestamp("responded_at"),
  isRead: boolean("is_read").notNull().default(false),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Activity logs
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: logActionEnum("action").notNull(),
  details: text("details"),
  metadata: jsonb("metadata"), // Additional data like question_id, table_number, etc.
  ipAddress: varchar("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Menu settings - Genel Sekreterlik tarafından yönetilen ana menü ayarları
export const menuSettings = pgTable("menu_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moderatorLoginEnabled: boolean("moderator_login_enabled").notNull().default(true),
  programFlowEnabled: boolean("program_flow_enabled").notNull().default(false),
  photosEnabled: boolean("photos_enabled").notNull().default(false),
  socialMediaEnabled: boolean("social_media_enabled").notNull().default(false),
  teamEnabled: boolean("team_enabled").notNull().default(false),
  moderatorLoginTitle: varchar("moderator_login_title").default("Moderatör Girişi"),
  programFlowTitle: varchar("program_flow_title").default("Program Akışı"),
  photosTitle: varchar("photos_title").default("Fotoğraflar"),
  socialMediaTitle: varchar("social_media_title").default("Sosyal Medya"),
  teamTitle: varchar("team_title").default("Ekibimiz"),
  // Ana sayfa metinleri
  mainTitle: varchar("main_title").default("AK Parti Gençlik Kolları"),
  mainSlogan: varchar("main_slogan").default("Milletin Gücüyle SINIRLARI AŞAN LİDERLİK"),
  campTitle: varchar("camp_title").default("İrade, İstikamet ve İstişare Kampı"),
  systemTitle: varchar("system_title").default("Yönetim Sistemi"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Program events - Program akışı için etkinlikler
export const programEvents = pgTable("program_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  location: varchar("location"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Social media accounts
export const socialMediaAccounts = pgTable("social_media_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: varchar("platform").notNull(), // Twitter, Instagram, Facebook, etc.
  accountName: varchar("account_name").notNull(),
  accountUrl: text("account_url").notNull(),
  displayOrder: integer("display_order").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Team members
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  position: varchar("position").notNull(), // Görev
  phoneNumber: varchar("phone_number"),
  email: varchar("email"),
  displayOrder: integer("display_order").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Uploaded files - Yüklenen arkaplan görselleri ve diğer dosyalar
export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  filePath: varchar("file_path").notNull(), // relative path from public folder
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Page layouts - Ana sayfa düzeni ve arkaplan ayarları
export const pageLayouts = pgTable("page_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().default("default"), // "default", "desktop", "mobile"
  backgroundImageDesktop: varchar("background_image_desktop").references(() => uploadedFiles.id),
  backgroundImageMobile: varchar("background_image_mobile").references(() => uploadedFiles.id),
  backgroundPosition: varchar("background_position").default("center center"),
  backgroundSize: varchar("background_size").default("cover"),
  backgroundColor: varchar("background_color").default("#f8f9fa"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Page elements - Sayfa öğeleri (metinler, butonlar) ve pozisyonları
export const pageElements = pgTable("page_elements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  layoutId: varchar("layout_id").notNull().references(() => pageLayouts.id, { onDelete: 'cascade' }),
  type: elementTypeEnum("type").notNull(),
  content: text("content").notNull(), // Text content or button label
  elementKey: varchar("element_key").notNull(), // "main_title", "slogan", "team_button", etc.
  positionX: integer("position_x").notNull().default(0), // X coordinate in pixels
  positionY: integer("position_y").notNull().default(0), // Y coordinate in pixels
  width: integer("width").default(200), // Element width in pixels
  height: integer("height").default(50), // Element height in pixels
  fontSize: varchar("font_size").default("16px"),
  fontWeight: varchar("font_weight").default("normal"),
  color: varchar("color").default("#000000"),
  backgroundColor: varchar("background_color"),
  borderRadius: varchar("border_radius").default("8px"),
  displayOrder: integer("display_order").notNull().default(1),
  isVisible: boolean("is_visible").notNull().default(true),
  deviceType: varchar("device_type").default("both"), // "desktop", "mobile", "both"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Photo requests - Fotoğraf talepleri
export const photoRequests = pgTable("photo_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tcNumber: varchar("tc_number", { length: 11 }).notNull(),
  email: varchar("email").notNull(),
  status: photoRequestStatusEnum("status").notNull().default('pending'),
  referencePhotoPath: varchar("reference_photo_path"), // Yüklenen referans fotoğraf yolu
  selectedFaceId: varchar("selected_face_id"), // Seçilen yüz ID'si
  faceData: jsonb("face_data"), // Web'den gelen yüz embedding verileri
  processedAt: timestamp("processed_at"),
  emailSentAt: timestamp("email_sent_at"),
  matchedPhotosCount: integer("matched_photos_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Detected faces - Tespit edilen yüzler
export const detectedFaces = pgTable("detected_faces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoRequestId: varchar("photo_request_id").notNull().references(() => photoRequests.id, { onDelete: 'cascade' }),
  faceImagePath: varchar("face_image_path").notNull(), // Kırpılmış yüz fotoğraf yolu
  confidence: varchar("confidence"), // Yüz tespit güvenilirlik oranı
  quality: faceQualityEnum("quality").notNull().default('good'),
  boundingBox: jsonb("bounding_box"), // Yüz koordinatları {x, y, width, height}
  landmarks: jsonb("landmarks"), // Yüz işaretleri
  embeddings: jsonb("embeddings"), // Yüz vektörleri face-api'den
  isSelected: boolean("is_selected").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Photo database - Kamp fotoğraf veritabanı
export const photoDatabase = pgTable("photo_database", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(),
  originalName: varchar("original_name"),
  fileSize: integer("file_size"), // bytes
  mimeType: varchar("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  isProcessed: boolean("is_processed").notNull().default(false),
  faceCount: integer("face_count").default(0),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Photo matches - Eşleşen fotoğraflar
export const photoMatches = pgTable("photo_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoRequestId: varchar("photo_request_id").notNull().references(() => photoRequests.id, { onDelete: 'cascade' }),
  photoDatabaseId: varchar("photo_database_id").notNull().references(() => photoDatabase.id, { onDelete: 'cascade' }),
  similarityScore: varchar("similarity_score"), // Benzerlik oranı
  matchedFaceBox: jsonb("matched_face_box"), // Eşleşen yüzün koordinatları
  isEmailSent: boolean("is_email_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Processing queue - İşlem kuyruğu
export const processingQueue = pgTable("processing_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoRequestId: varchar("photo_request_id").notNull().references(() => photoRequests.id, { onDelete: 'cascade' }),
  queuePosition: integer("queue_position").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0), // 0-100 arası
  currentStep: varchar("current_step"), // "face_detection", "matching", "email_sending"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Camp days - Kamp günleri (günlük model yönetimi için)
export const campDays = pgTable("camp_days", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dayName: varchar("day_name").notNull(), // "15 Ağustos", "16 Ağustos" vb.
  dayDate: timestamp("day_date").notNull(),
  modelPath: varchar("model_path"), // Python modeli dosya yolu
  modelStatus: varchar("model_status").notNull().default('not_trained'), // 'not_trained', 'training', 'ready', 'error'
  photoCount: integer("photo_count").default(0), // Bu güne ait fotoğraf sayısı
  faceCount: integer("face_count").default(0), // Bu güne ait tespit edilen yüz sayısı
  lastTrainedAt: timestamp("last_trained_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Photo request days - Fotoğraf isteklerinin hangi günlere ait olduğunu belirten ilişki tablosu
export const photoRequestDays = pgTable("photo_request_days", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoRequestId: varchar("photo_request_id").notNull().references(() => photoRequests.id, { onDelete: 'cascade' }),
  campDayId: varchar("camp_day_id").notNull().references(() => campDays.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Face models - Yüz tanıma modelleri (buffalo_l modeli ile eğitilmiş veritabanları)
export const faceModels = pgTable("face_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // Model adı (örn: "15 Ağustos Kampı")
  googleDriveLink: text("google_drive_link").notNull(), // Google Drive zip linki
  serverPath: varchar("server_path"), // /opt/face_match/allmodels/<modelAdi>/ dizini
  status: faceModelStatusEnum("status").notNull().default('pending'),
  downloadProgress: integer("download_progress").default(0), // 0-100 arası
  errorMessage: text("error_message"), // Hata durumunda mesaj
  fileSize: integer("file_size"), // ZIP dosyası boyutu (bytes)
  extractedSize: integer("extracted_size"), // Açılmış klasör boyutu (bytes)
  faceCount: integer("face_count").default(0), // face_database.pkl'deki yüz sayısı
  trainingDataPath: varchar("training_data_path"), // Eğitim verisi klasör yolu
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }), // Genel Sekreterlik kullanıcısı
  processedAt: timestamp("processed_at"), // İşlem tamamlanma zamanı
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Photo matching sessions - Kullanıcı fotoğraf eşleştirme oturumları
export const photoMatchingSessions = pgTable("photo_matching_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tcNumber: varchar("tc_number", { length: 11 }).notNull(),
  uploadedPhotoPath: varchar("uploaded_photo_path"), // Yüklenen fotoğraf yolu (nullable - daha sonra doldurulur)
  selectedFaceData: jsonb("selected_face_data"), // Kullanıcının seçtiği yüz verileri
  selectedModelIds: jsonb("selected_model_ids").notNull(), // Seçilen model ID'leri array
  status: photoRequestStatusEnum("status").notNull().default('face_detection'),
  queuePosition: integer("queue_position"), // Kuyruk sırası
  progressPercentage: integer("progress_percentage").default(0), // 0-100 arası
  currentStep: varchar("current_step").default('face_detection'), // "face_detection", "matching", "completed"
  timeoutAt: timestamp("timeout_at").notNull(), // 3 saatlik zaman aşımı
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Face model matching results - Model bazlı eşleştirme sonuçları
export const faceModelMatchingResults = pgTable("face_model_matching_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => photoMatchingSessions.id, { onDelete: 'cascade' }),
  faceModelId: varchar("face_model_id").notNull().references(() => faceModels.id, { onDelete: 'cascade' }),
  matchedPhotos: jsonb("matched_photos").notNull(), // Eşleşen fotoğrafların listesi
  similarityThreshold: varchar("similarity_threshold").default('0.6'), // Benzerlik eşiği
  totalMatches: integer("total_matches").default(0),
  zipFilePath: varchar("zip_file_path"), // matched/{TCKN}_{modelAdi}.zip
  zipCreatedAt: timestamp("zip_created_at"),
  downloadedAt: timestamp("downloaded_at"),
  isZipReady: boolean("is_zip_ready").notNull().default(false),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System settings - Sistem ayarları (timeout vs.)
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  questions: many(questions),
  answers: many(answers),
  feedback: many(feedback),
  activityLogs: many(activityLogs),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [questions.createdBy],
    references: [users.id],
  }),
  answers: many(answers),
  feedback: many(feedback),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
  user: one(users, {
    fields: [answers.userId],
    references: [users.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  question: one(questions, {
    fields: [feedback.questionId],
    references: [questions.id],
  }),
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [uploadedFiles.uploadedBy],
    references: [users.id],
  }),
}));

export const pageLayoutsRelations = relations(pageLayouts, ({ one, many }) => ({
  backgroundImageDesktop: one(uploadedFiles, {
    fields: [pageLayouts.backgroundImageDesktop],
    references: [uploadedFiles.id],
  }),
  backgroundImageMobile: one(uploadedFiles, {
    fields: [pageLayouts.backgroundImageMobile],
    references: [uploadedFiles.id],
  }),
  elements: many(pageElements),
}));

export const pageElementsRelations = relations(pageElements, ({ one }) => ({
  layout: one(pageLayouts, {
    fields: [pageElements.layoutId],
    references: [pageLayouts.id],
  }),
}));

export const photoRequestsRelations = relations(photoRequests, ({ many }) => ({
  detectedFaces: many(detectedFaces),
  photoMatches: many(photoMatches),
  processingQueue: many(processingQueue),
  photoRequestDays: many(photoRequestDays),
}));

export const detectedFacesRelations = relations(detectedFaces, ({ one }) => ({
  photoRequest: one(photoRequests, {
    fields: [detectedFaces.photoRequestId],
    references: [photoRequests.id],
  }),
}));

export const photoDatabaseRelations = relations(photoDatabase, ({ one, many }) => ({
  uploadedBy: one(users, {
    fields: [photoDatabase.uploadedBy],
    references: [users.id],
  }),
  photoMatches: many(photoMatches),
}));

export const photoMatchesRelations = relations(photoMatches, ({ one }) => ({
  photoRequest: one(photoRequests, {
    fields: [photoMatches.photoRequestId],
    references: [photoRequests.id],
  }),
  photoDatabase: one(photoDatabase, {
    fields: [photoMatches.photoDatabaseId],
    references: [photoDatabase.id],
  }),
}));

export const processingQueueRelations = relations(processingQueue, ({ one }) => ({
  photoRequest: one(photoRequests, {
    fields: [processingQueue.photoRequestId],
    references: [photoRequests.id],
  }),
}));

export const campDaysRelations = relations(campDays, ({ many }) => ({
  photoRequestDays: many(photoRequestDays),
}));

export const photoRequestDaysRelations = relations(photoRequestDays, ({ one }) => ({
  photoRequest: one(photoRequests, {
    fields: [photoRequestDays.photoRequestId],
    references: [photoRequests.id],
  }),
  campDay: one(campDays, {
    fields: [photoRequestDays.campDayId],
    references: [campDays.id],
  }),
}));

export const faceModelsRelations = relations(faceModels, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [faceModels.createdBy],
    references: [users.id],
  }),
  matchingResults: many(faceModelMatchingResults),
}));

export const photoMatchingSessionsRelations = relations(photoMatchingSessions, ({ many }) => ({
  matchingResults: many(faceModelMatchingResults),
}));

export const faceModelMatchingResultsRelations = relations(faceModelMatchingResults, ({ one }) => ({
  session: one(photoMatchingSessions, {
    fields: [faceModelMatchingResults.sessionId],
    references: [photoMatchingSessions.id],
  }),
  faceModel: one(faceModels, {
    fields: [faceModelMatchingResults.faceModelId],
    references: [faceModels.id],
  }),
}));

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updatedBy: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTableSchema = createInsertSchema(tables).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnswerSchema = createInsertSchema(answers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  response: true,
  respondedBy: true,
  respondedAt: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertMenuSettingsSchema = createInsertSchema(menuSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertProgramEventSchema = createInsertSchema(programEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocialMediaAccountSchema = createInsertSchema(socialMediaAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  createdAt: true,
});

export const insertPageLayoutSchema = createInsertSchema(pageLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPageElementSchema = createInsertSchema(pageElements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhotoRequestSchema = createInsertSchema(photoRequests).omit({
  id: true,
  processedAt: true,
  emailSentAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDetectedFaceSchema = createInsertSchema(detectedFaces).omit({
  id: true,
  createdAt: true,
});

export const insertPhotoDatabaseSchema = createInsertSchema(photoDatabase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhotoMatchSchema = createInsertSchema(photoMatches).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingQueueSchema = createInsertSchema(processingQueue).omit({
  id: true,
  createdAt: true,
});

export const insertCampDaySchema = createInsertSchema(campDays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhotoRequestDaySchema = createInsertSchema(photoRequestDays).omit({
  id: true,
  createdAt: true,
});

// Basit model oluşturma schema'sı - sadece Google Drive linki gerekli
// Model adı ve diğer bilgiler ZIP içindeki model_info.json'dan okunacak
export const insertFaceModelSchema = z.object({
  googleDriveLink: z.string().url("Geçerli bir Google Drive linki giriniz")
});

// Extended face model type including createdBy for internal use
export const createFaceModelSchema = insertFaceModelSchema.extend({
  createdBy: z.string(),
});

export const insertPhotoMatchingSessionSchema = createInsertSchema(photoMatchingSessions).omit({
  id: true,
  queuePosition: true,
  progressPercentage: true,
  startedAt: true,
  completedAt: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFaceModelMatchingResultSchema = createInsertSchema(faceModelMatchingResults).omit({
  id: true,
  zipFilePath: true,
  zipCreatedAt: true,
  downloadedAt: true,
  isZipReady: true,
  processingError: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Table = typeof tables.$inferSelect;
export type InsertTable = z.infer<typeof insertTableSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type MenuSettings = typeof menuSettings.$inferSelect;
export type InsertMenuSettings = z.infer<typeof insertMenuSettingsSchema>;
export type ProgramEvent = typeof programEvents.$inferSelect;
export type InsertProgramEvent = z.infer<typeof insertProgramEventSchema>;
export type SocialMediaAccount = typeof socialMediaAccounts.$inferSelect;
export type InsertSocialMediaAccount = z.infer<typeof insertSocialMediaAccountSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type PageLayout = typeof pageLayouts.$inferSelect;
export type InsertPageLayout = z.infer<typeof insertPageLayoutSchema>;
export type PageElement = typeof pageElements.$inferSelect;
export type InsertPageElement = z.infer<typeof insertPageElementSchema>;
export type PhotoRequest = typeof photoRequests.$inferSelect;
export type InsertPhotoRequest = z.infer<typeof insertPhotoRequestSchema>;
export type DetectedFace = typeof detectedFaces.$inferSelect;
export type InsertDetectedFace = z.infer<typeof insertDetectedFaceSchema>;
export type PhotoDatabase = typeof photoDatabase.$inferSelect;
export type InsertPhotoDatabase = z.infer<typeof insertPhotoDatabaseSchema>;
export type PhotoMatch = typeof photoMatches.$inferSelect;
export type InsertPhotoMatch = z.infer<typeof insertPhotoMatchSchema>;
export type ProcessingQueue = typeof processingQueue.$inferSelect;
export type InsertProcessingQueue = z.infer<typeof insertProcessingQueueSchema>;
export type CampDay = typeof campDays.$inferSelect;
export type InsertCampDay = z.infer<typeof insertCampDaySchema>;
export type PhotoRequestDay = typeof photoRequestDays.$inferSelect;
export type InsertPhotoRequestDay = z.infer<typeof insertPhotoRequestDaySchema>;
export type FaceModel = typeof faceModels.$inferSelect;
export type InsertFaceModel = z.infer<typeof insertFaceModelSchema>;
export type CreateFaceModel = z.infer<typeof createFaceModelSchema>;
export type PhotoMatchingSession = typeof photoMatchingSessions.$inferSelect;
export type InsertPhotoMatchingSession = z.infer<typeof insertPhotoMatchingSessionSchema>;
export type FaceModelMatchingResult = typeof faceModelMatchingResults.$inferSelect;
export type InsertFaceModelMatchingResult = z.infer<typeof insertFaceModelMatchingResultSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

// Additional types for API responses
export type UserWithStats = User & {
  answersCount?: number;
  lastActivity?: string;
};

export type QuestionWithStats = Question & {
  answersCount?: number;
  createdByName?: string;
  assignedTableNames?: string[];
};

export type AnswerWithDetails = Answer & {
  questionText?: string | null;
  userName?: string | null;
};

export type FeedbackWithDetails = Feedback & {
  questionText?: string | null;
  userName?: string | null;
  userTableNumber?: number | null;
  respondedByName?: string | null;
};

export type ActivityLogWithUser = ActivityLog & {
  userFirstName?: string | null;
  userLastName?: string | null;
  userTcNumber?: string | null;
};

export type PageLayoutWithFiles = PageLayout & {
  backgroundImageDesktopFile?: UploadedFile | null;
  backgroundImageMobileFile?: UploadedFile | null;
  elements?: PageElement[];
};

export type PageElementWithLayout = PageElement & {
  layout?: PageLayout | null;
};

export type PhotoRequestWithDetails = PhotoRequest & {
  detectedFacesCount?: number;
  selectedFace?: DetectedFace | null;
  matchesCount?: number;
  queuePosition?: number;
  selectedDays?: CampDay[];
  selectedCampDays?: string[]; // Seçilen kamp günü ID'leri (Python GUI için)
};

export type CampDayWithStats = CampDay & {
  requestsCount?: number;
  isSelected?: boolean;
};

export type DetectedFaceWithRequest = DetectedFace & {
  photoRequest?: PhotoRequest | null;
};

export type PhotoDatabaseWithDetails = PhotoDatabase & {
  uploadedByName?: string | null;
  matchesCount?: number;
};

export type PhotoMatchWithDetails = PhotoMatch & {
  photoRequest?: PhotoRequest | null;
  photoDatabase?: PhotoDatabase | null;
};

export type ProcessingQueueWithDetails = ProcessingQueue & {
  photoRequest?: PhotoRequest | null;
  tcNumber?: string | null;
  email?: string | null;
};
