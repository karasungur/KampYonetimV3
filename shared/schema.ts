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
});

// Questions
export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  type: questionTypeEnum("type").notNull().default('general'),
  assignedTables: jsonb("assigned_tables"), // Array of table numbers for specific questions
  createdBy: varchar("created_by").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Answers/Responses
export const answers = pgTable("answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => questions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
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
  userId: varchar("user_id").notNull().references(() => users.id), // moderator who sent feedback
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
  userId: varchar("user_id").notNull().references(() => users.id),
  action: logActionEnum("action").notNull(),
  details: text("details"),
  metadata: jsonb("metadata"), // Additional data like question_id, table_number, etc.
  ipAddress: varchar("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
