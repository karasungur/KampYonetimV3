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
