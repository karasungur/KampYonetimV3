import {
  users,
  tables,
  questions,
  answers,
  feedback,
  activityLogs,
  type User,
  type InsertUser,
  type Table,
  type InsertTable,
  type Question,
  type InsertQuestion,
  type Answer,
  type InsertAnswer,
  type Feedback,
  type InsertFeedback,
  type ActivityLog,
  type InsertActivityLog,
  type UserWithStats,
  type QuestionWithStats,
  type AnswerWithDetails,
  type FeedbackWithDetails,
  type ActivityLogWithUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql, count, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByTcNumber(tcNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  getAllUsers(): Promise<UserWithStats[]>;
  deleteUser(id: string): Promise<void>;
  deleteAnswersByUser(userId: string): Promise<void>;
  deleteFeedbackByUser(userId: string): Promise<void>;
  
  // Table operations
  createTable(table: InsertTable): Promise<Table>;
  getAllTables(): Promise<Table[]>;
  getTable(id: string): Promise<Table | undefined>;
  deleteTable(id: string): Promise<void>;
  updateTable(id: string, updates: Partial<InsertTable>): Promise<Table>;
  getTableByNumber(number: number): Promise<Table | undefined>;
  getAllTablesWithStats(): Promise<any[]>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  getAllQuestions(pagination?: { limit: number; offset: number }): Promise<{ questions: QuestionWithStats[]; total: number }>;
  getQuestionsForTable(tableNumber: number, pagination?: { limit: number; offset: number }): Promise<{ questions: QuestionWithStats[]; total: number }>;
  getQuestion(id: string): Promise<Question | undefined>;
  
  // Answer operations
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  updateAnswer(id: string, updates: Partial<InsertAnswer>): Promise<Answer>;
  deleteAnswer(id: string): Promise<void>;
  getAnswersForQuestion(questionId: string): Promise<AnswerWithDetails[]>;
  getAnswersForUser(userId: string): Promise<AnswerWithDetails[]>;
  getAllAnswers(): Promise<AnswerWithDetails[]>;
  
  // Feedback operations
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<FeedbackWithDetails[]>;
  markFeedbackAsRead(id: string): Promise<void>;
  markFeedbackAsResolved(id: string): Promise<void>;
  getFeedback(id: string): Promise<Feedback | undefined>;
  deleteFeedback(id: string): Promise<void>;
  respondToFeedback(id: string, response: string, respondedBy: string): Promise<void>;
  getFeedbackForUser(userId: string): Promise<FeedbackWithDetails[]>;
  
  // Activity log operations
  logActivity(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  getActivityLogsForUser(userId: string, limit?: number): Promise<ActivityLog[]>;
  
  // Dashboard stats
  getDashboardStats(): Promise<{
    totalTables: number;
    totalQuestions: number;
    totalAnswers: number;
    pendingAnswers: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByTcNumber(tcNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.tcNumber, tcNumber));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }

  async getAllUsers(): Promise<UserWithStats[]> {
    const result = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        tcNumber: users.tcNumber,
        password: users.password,
        role: users.role,
        tableNumber: users.tableNumber,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        answersCount: count(answers.id),
      })
      .from(users)
      .leftJoin(answers, eq(users.id, answers.userId))
      .groupBy(users.id)
      .orderBy(users.createdAt);
    
    return result;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async deleteAnswersByUser(userId: string): Promise<void> {
    await db.delete(answers).where(eq(answers.userId, userId));
  }

  async deleteFeedbackByUser(userId: string): Promise<void> {
    await db.delete(feedback).where(eq(feedback.userId, userId));
  }

  // Table operations
  async createTable(insertTable: InsertTable): Promise<Table> {
    const [table] = await db
      .insert(tables)
      .values(insertTable)
      .returning();
    return table;
  }

  async getAllTables(): Promise<Table[]> {
    return db.select().from(tables).where(eq(tables.isActive, true)).orderBy(tables.number);
  }

  async getAllTablesWithStats(): Promise<(Table & { userCount: number })[]> {
    const tablesWithUsers = await db
      .select({
        id: tables.id,
        number: tables.number,
        name: tables.name,
        isActive: tables.isActive,
        createdAt: tables.createdAt,
        updatedAt: tables.updatedAt,
        userCount: count(users.id),
      })
      .from(tables)
      .leftJoin(users, and(eq(users.tableNumber, tables.number), eq(users.isActive, true)))
      .where(eq(tables.isActive, true))
      .groupBy(tables.id, tables.number, tables.name, tables.isActive, tables.createdAt, tables.updatedAt)
      .orderBy(tables.number);

    return tablesWithUsers;
  }

  async getAllTablesWithDetails(): Promise<(Table & { userCount: number, users: Array<{ id: string; firstName: string; lastName: string; role: string }> })[]> {
    // First get all tables
    const allTables = await db
      .select()
      .from(tables)
      .where(eq(tables.isActive, true))
      .orderBy(tables.number);

    // Then get users grouped by table
    const tableUsers = await db
      .select({
        tableNumber: users.tableNumber,
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.isActive, true));

    // Combine the data
    const tablesWithDetails = allTables.map(table => {
      const tableUserList = tableUsers.filter(u => u.tableNumber === table.number);
      return {
        ...table,
        userCount: tableUserList.length,
        users: tableUserList,
      };
    });

    return tablesWithDetails;
  }

  async getTable(id: string): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.id, id));
    return table || undefined;
  }

  async getTableByNumber(number: number): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.number, number));
    return table || undefined;
  }

  async deleteTable(id: string): Promise<void> {
    await db
      .update(tables)
      .set({ isActive: false })
      .where(eq(tables.id, id));
  }

  async updateTable(id: string, updates: Partial<InsertTable>): Promise<Table> {
    const [table] = await db
      .update(tables)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tables.id, id))
      .returning();
    return table;
  }

  // Question operations
  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [question] = await db
      .insert(questions)
      .values(insertQuestion)
      .returning();
    return question;
  }

  async updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question> {
    const [question] = await db
      .update(questions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  async deleteQuestion(id: string): Promise<void> {
    await db
      .update(questions)
      .set({ isActive: false })
      .where(eq(questions.id, id));
  }

  async getAllQuestions(pagination?: { limit: number; offset: number }): Promise<{ questions: QuestionWithStats[]; total: number }> {
    // Önce toplam sayıyı al
    const [totalResult] = await db
      .select({ count: count() })
      .from(questions)
      .where(eq(questions.isActive, true));
    
    const total = totalResult?.count || 0;
    
    // Sonra sayfalanmış veriyi al
    const baseQuery = db
      .select({
        id: questions.id,
        text: questions.text,
        type: questions.type,
        assignedTables: questions.assignedTables,
        createdBy: questions.createdBy,
        isActive: questions.isActive,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
        answersCount: count(answers.id),
        createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(questions)
      .leftJoin(answers, eq(questions.id, answers.questionId))
      .leftJoin(users, eq(questions.createdBy, users.id))
      .where(eq(questions.isActive, true))
      .groupBy(questions.id, users.firstName, users.lastName)
      .orderBy(desc(questions.createdAt));
    
    const questionsList = pagination 
      ? await baseQuery.limit(pagination.limit).offset(pagination.offset)
      : await baseQuery;
    
    return { questions: questionsList, total };
  }

  async getQuestionsForTable(tableNumber: number, pagination?: { limit: number; offset: number }): Promise<{ questions: QuestionWithStats[]; total: number }> {
    // Önce toplam sayıyı al
    const [totalResult] = await db
      .select({ count: count() })
      .from(questions)
      .where(
        and(
          eq(questions.isActive, true),
          or(
            eq(questions.type, 'general'),
            sql`${questions.assignedTables}::jsonb ? ${tableNumber.toString()}`
          )
        )
      );
    
    const total = totalResult?.count || 0;
    
    // Sonra sayfalanmış veriyi al
    const baseQuery = db
      .select({
        id: questions.id,
        text: questions.text,
        type: questions.type,
        assignedTables: questions.assignedTables,
        createdBy: questions.createdBy,
        isActive: questions.isActive,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
        answersCount: count(answers.id),
        createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(questions)
      .leftJoin(answers, and(eq(questions.id, answers.questionId), eq(answers.tableNumber, tableNumber)))
      .leftJoin(users, eq(questions.createdBy, users.id))
      .where(
        and(
          eq(questions.isActive, true),
          or(
            eq(questions.type, 'general'),
            sql`${questions.assignedTables}::jsonb ? ${tableNumber.toString()}`
          )
        )
      )
      .groupBy(questions.id, users.firstName, users.lastName)
      .orderBy(desc(questions.createdAt));
    
    const questionsList = pagination 
      ? await baseQuery.limit(pagination.limit).offset(pagination.offset)
      : await baseQuery;
    
    return { questions: questionsList, total };
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question || undefined;
  }

  // Answer operations
  async createAnswer(insertAnswer: InsertAnswer): Promise<Answer> {
    const [answer] = await db
      .insert(answers)
      .values(insertAnswer)
      .returning();
    return answer;
  }

  async updateAnswer(id: string, updates: Partial<InsertAnswer>): Promise<Answer> {
    const [answer] = await db
      .update(answers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(answers.id, id))
      .returning();
    return answer;
  }

  async deleteAnswer(id: string): Promise<void> {
    await db.delete(answers).where(eq(answers.id, id));
  }

  async getAnswersForQuestion(questionId: string): Promise<AnswerWithDetails[]> {
    const result = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        userId: answers.userId,
        tableNumber: answers.tableNumber,
        text: answers.text,
        orderIndex: answers.orderIndex,
        createdAt: answers.createdAt,
        updatedAt: answers.updatedAt,
        questionText: questions.text,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(answers)
      .leftJoin(questions, eq(answers.questionId, questions.id))
      .leftJoin(users, eq(answers.userId, users.id))
      .where(eq(answers.questionId, questionId))
      .orderBy(answers.tableNumber, answers.orderIndex);
    
    return result;
  }

  async getAnswersForUser(userId: string): Promise<AnswerWithDetails[]> {
    const result = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        userId: answers.userId,
        tableNumber: answers.tableNumber,
        text: answers.text,
        orderIndex: answers.orderIndex,
        createdAt: answers.createdAt,
        updatedAt: answers.updatedAt,
        questionText: questions.text,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(answers)
      .leftJoin(questions, eq(answers.questionId, questions.id))
      .leftJoin(users, eq(answers.userId, users.id))
      .where(eq(answers.userId, userId))
      .orderBy(desc(answers.createdAt));
    
    return result;
  }

  async getAllAnswers(): Promise<AnswerWithDetails[]> {
    const result = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        userId: answers.userId,
        tableNumber: answers.tableNumber,
        text: answers.text,
        orderIndex: answers.orderIndex,
        createdAt: answers.createdAt,
        updatedAt: answers.updatedAt,
        questionText: questions.text,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(answers)
      .leftJoin(questions, eq(answers.questionId, questions.id))
      .leftJoin(users, eq(answers.userId, users.id))
      .orderBy(desc(answers.createdAt));
    
    return result;
  }

  // Feedback operations
  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const [feedbackItem] = await db
      .insert(feedback)
      .values(insertFeedback)
      .returning();
    return feedbackItem;
  }

  async getAllFeedback(): Promise<FeedbackWithDetails[]> {
    const result = await db
      .select({
        id: feedback.id,
        questionId: feedback.questionId,
        userId: feedback.userId,
        message: feedback.message,
        response: feedback.response,
        respondedBy: feedback.respondedBy,
        respondedAt: feedback.respondedAt,
        isRead: feedback.isRead,
        isResolved: feedback.isResolved,
        createdAt: feedback.createdAt,
        questionText: questions.text,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        userTableNumber: users.tableNumber,
        respondedByName: sql<string>`resp.first_name || ' ' || resp.last_name`,
      })
      .from(feedback)
      .leftJoin(questions, eq(feedback.questionId, questions.id))
      .leftJoin(users, eq(feedback.userId, users.id))
      .leftJoin(sql`users AS resp`, eq(feedback.respondedBy, sql`resp.id`))
      .orderBy(desc(feedback.createdAt));
    
    return result;
  }

  async markFeedbackAsRead(id: string): Promise<void> {
    await db
      .update(feedback)
      .set({ isRead: true })
      .where(eq(feedback.id, id));
  }

  async markFeedbackAsResolved(id: string): Promise<void> {
    await db
      .update(feedback)
      .set({ isResolved: true })
      .where(eq(feedback.id, id));
  }

  async getFeedbackForUser(userId: string): Promise<FeedbackWithDetails[]> {
    const result = await db
      .select({
        id: feedback.id,
        questionId: feedback.questionId,
        userId: feedback.userId,
        message: feedback.message,
        response: feedback.response,
        respondedBy: feedback.respondedBy,
        respondedAt: feedback.respondedAt,
        isRead: feedback.isRead,
        isResolved: feedback.isResolved,
        createdAt: feedback.createdAt,
        questionText: questions.text,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        userTableNumber: users.tableNumber,
        respondedByName: sql<string>`resp.first_name || ' ' || resp.last_name`,
      })
      .from(feedback)
      .leftJoin(questions, eq(feedback.questionId, questions.id))
      .leftJoin(users, eq(feedback.userId, users.id))
      .leftJoin(sql`users AS resp`, eq(feedback.respondedBy, sql`resp.id`))
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.createdAt));
    
    return result;
  }

  async respondToFeedback(id: string, response: string, respondedBy: string): Promise<void> {
    await db
      .update(feedback)
      .set({ 
        response, 
        respondedBy,
        respondedAt: new Date(),
        isRead: true 
      })
      .where(eq(feedback.id, id));
  }

  async getFeedback(id: string): Promise<Feedback | undefined> {
    const [feedbackItem] = await db.select().from(feedback).where(eq(feedback.id, id));
    return feedbackItem || undefined;
  }

  async deleteFeedback(id: string): Promise<void> {
    await db.delete(feedback).where(eq(feedback.id, id));
  }

  // Activity log operations
  async logActivity(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getActivityLogs(limit: number = 100): Promise<ActivityLogWithUser[]> {
    return db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        action: activityLogs.action,
        details: activityLogs.details,
        metadata: activityLogs.metadata,
        ipAddress: activityLogs.ipAddress,
        createdAt: activityLogs.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userTcNumber: users.tcNumber,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }
  
  async getActivityLogsForUser(userId: string, limit: number = 100): Promise<ActivityLogWithUser[]> {
    return db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        action: activityLogs.action,
        details: activityLogs.details,
        metadata: activityLogs.metadata,
        ipAddress: activityLogs.ipAddress,
        createdAt: activityLogs.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userTcNumber: users.tcNumber,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  // Dashboard stats
  async getDashboardStats(): Promise<{
    totalTables: number;
    totalQuestions: number;
    totalAnswers: number;
    pendingAnswers: number;
  }> {
    const [tablesCount] = await db
      .select({ count: count(tables.id) })
      .from(tables)
      .where(eq(tables.isActive, true));

    const [questionsCount] = await db
      .select({ count: count(questions.id) })
      .from(questions)
      .where(eq(questions.isActive, true));

    const [answersCount] = await db
      .select({ count: count(answers.id) })
      .from(answers);

    // Calculate pending answers (questions without answers from tables they're assigned to)
    const allQuestionsWithAnswers = await db
      .select({
        questionId: questions.id,
        type: questions.type,
        assignedTables: questions.assignedTables,
        answeredTables: sql<number[]>`COALESCE(array_agg(DISTINCT ${answers.tableNumber}) FILTER (WHERE ${answers.tableNumber} IS NOT NULL), '{}')`,
      })
      .from(questions)
      .leftJoin(answers, eq(questions.id, answers.questionId))
      .where(eq(questions.isActive, true))
      .groupBy(questions.id);

    let pendingCount = 0;
    for (const q of allQuestionsWithAnswers) {
      if (q.type === 'general') {
        const activeTables = await db.select({ number: tables.number }).from(tables).where(eq(tables.isActive, true));
        const totalTables = activeTables.length;
        const answeredTables = q.answeredTables.length;
        pendingCount += totalTables - answeredTables;
      } else if (q.assignedTables && Array.isArray(q.assignedTables)) {
        const assignedCount = q.assignedTables.length;
        const answeredCount = q.answeredTables.filter(t => (q.assignedTables as number[]).includes(t)).length;
        pendingCount += assignedCount - answeredCount;
      }
    }

    return {
      totalTables: tablesCount.count,
      totalQuestions: questionsCount.count,
      totalAnswers: answersCount.count,
      pendingAnswers: pendingCount,
    };
  }
}

export const storage = new DatabaseStorage();
