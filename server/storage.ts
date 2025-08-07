import {
  users,
  tables,
  questions,
  answers,
  feedback,
  activityLogs,
  menuSettings,
  programEvents,
  socialMediaAccounts,
  teamMembers,
  uploadedFiles,
  pageLayouts,
  pageElements,
  photoRequests,
  detectedFaces,
  photoDatabase,
  photoMatches,
  processingQueue,
  campDays,
  photoRequestDays,
  faceModels,
  photoMatchingSessions,
  faceModelMatchingResults,
  systemSettings,
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
  type MenuSettings,
  type InsertMenuSettings,
  type ProgramEvent,
  type InsertProgramEvent,
  type SocialMediaAccount,
  type InsertSocialMediaAccount,
  type TeamMember,
  type InsertTeamMember,
  type UploadedFile,
  type InsertUploadedFile,
  type PageLayout,
  type InsertPageLayout,
  type PageElement,
  type InsertPageElement,
  type PhotoRequest,
  type InsertPhotoRequest,
  type DetectedFace,
  type InsertDetectedFace,
  type PhotoDatabase,
  type InsertPhotoDatabase,
  type PhotoMatch,
  type InsertPhotoMatch,
  type ProcessingQueue,
  type InsertProcessingQueue,
  type CampDay,
  type InsertCampDay,
  type PhotoRequestDay,
  type InsertPhotoRequestDay,
  type FaceModel,
  type InsertFaceModel,
  type CreateFaceModel,
  type PhotoMatchingSession,
  type InsertPhotoMatchingSession,
  type FaceModelMatchingResult,
  type InsertFaceModelMatchingResult,
  type SystemSettings,
  type InsertSystemSettings,
  type UserWithStats,
  type QuestionWithStats,
  type AnswerWithDetails,
  type FeedbackWithDetails,
  type ActivityLogWithUser,
  type PageLayoutWithFiles,
  type PhotoRequestWithDetails,
  type DetectedFaceWithRequest,
  type PhotoDatabaseWithDetails,
  type PhotoMatchWithDetails,
  type ProcessingQueueWithDetails,
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
  
  // Menu settings operations
  getMenuSettings(): Promise<MenuSettings | undefined>;
  updateMenuSettings(settings: InsertMenuSettings): Promise<MenuSettings>;
  
  // Program events operations
  createProgramEvent(event: InsertProgramEvent): Promise<ProgramEvent>;
  getAllProgramEvents(): Promise<ProgramEvent[]>;
  updateProgramEvent(id: string, updates: Partial<InsertProgramEvent>): Promise<ProgramEvent>;
  deleteProgramEvent(id: string): Promise<void>;
  
  // Social media accounts operations
  createSocialMediaAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount>;
  getAllSocialMediaAccounts(): Promise<SocialMediaAccount[]>;
  updateSocialMediaAccount(id: string, updates: Partial<InsertSocialMediaAccount>): Promise<SocialMediaAccount>;
  deleteSocialMediaAccount(id: string): Promise<void>;
  
  // Team members operations
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  getAllTeamMembers(): Promise<TeamMember[]>;
  updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;
  
  // File upload operations
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  getUploadedFile(id: string): Promise<UploadedFile | undefined>;
  getAllUploadedFiles(): Promise<UploadedFile[]>;
  deleteUploadedFile(id: string): Promise<void>;
  
  // Page layout operations
  createPageLayout(layout: InsertPageLayout): Promise<PageLayout>;
  getPageLayout(id: string): Promise<PageLayoutWithFiles | undefined>;
  getActivePageLayout(): Promise<PageLayoutWithFiles | undefined>;
  getAllPageLayouts(): Promise<PageLayoutWithFiles[]>;
  updatePageLayout(id: string, updates: Partial<InsertPageLayout>): Promise<PageLayout>;
  deletePageLayout(id: string): Promise<void>;
  
  // Page element operations
  createPageElement(element: InsertPageElement): Promise<PageElement>;
  getPageElement(id: string): Promise<PageElement | undefined>;
  getPageElementsByLayout(layoutId: string): Promise<PageElement[]>;
  updatePageElement(id: string, updates: Partial<InsertPageElement>): Promise<PageElement>;
  deletePageElement(id: string): Promise<void>;
  updateElementPosition(id: string, positionX: number, positionY: number): Promise<void>;
  
  // Photo management operations
  createPhotoRequest(request: InsertPhotoRequest): Promise<PhotoRequest>;
  getPhotoRequest(id: string): Promise<PhotoRequest | undefined>;
  getPhotoRequestByTc(tcNumber: string): Promise<PhotoRequest | undefined>;
  updatePhotoRequest(id: string, updates: Partial<InsertPhotoRequest>): Promise<PhotoRequest>;
  getAllPhotoRequests(): Promise<PhotoRequestWithDetails[]>;
  
  // Detected faces operations
  createDetectedFace(face: InsertDetectedFace): Promise<DetectedFace>;
  getDetectedFacesByRequest(photoRequestId: string): Promise<DetectedFace[]>;
  updateDetectedFace(id: string, updates: Partial<InsertDetectedFace>): Promise<DetectedFace>;
  selectDetectedFace(photoRequestId: string, faceId: string): Promise<void>;
  
  // Photo database operations
  createPhotoDatabase(photo: InsertPhotoDatabase): Promise<PhotoDatabase>;
  getAllPhotosInDatabase(): Promise<PhotoDatabaseWithDetails[]>;
  updatePhotoDatabase(id: string, updates: Partial<InsertPhotoDatabase>): Promise<PhotoDatabase>;
  deletePhotoFromDatabase(id: string): Promise<void>;
  
  // Photo matches operations
  createPhotoMatch(match: InsertPhotoMatch): Promise<PhotoMatch>;
  getPhotoMatchesByRequest(photoRequestId: string): Promise<PhotoMatchWithDetails[]>;
  markMatchEmailSent(matchId: string): Promise<void>;
  
  // Processing queue operations
  addToProcessingQueue(queueItem: InsertProcessingQueue): Promise<ProcessingQueue>;
  getNextInQueue(): Promise<ProcessingQueueWithDetails | undefined>;
  updateQueueProgress(id: string, progress: number, currentStep: string): Promise<void>;
  completeQueueItem(id: string): Promise<void>;
  getQueueStatus(): Promise<ProcessingQueueWithDetails[]>;
  
  // Camp days operations
  getAllCampDays(): Promise<CampDay[]>;
  createCampDay(campDay: InsertCampDay): Promise<CampDay>;
  updateCampDay(id: string, updates: Partial<InsertCampDay>): Promise<CampDay>;
  deleteCampDay(id: string): Promise<void>;
  deleteAllCampDays(): Promise<void>;
  
  // Photo request days operations
  createPhotoRequestDay(requestDay: InsertPhotoRequestDay): Promise<PhotoRequestDay>;
  getPhotoRequestDays(photoRequestId: string): Promise<CampDay[]>;
  deletePhotoRequestDays(photoRequestId: string): Promise<void>;
  
  // Face models operations
  createFaceModel(model: InsertFaceModel): Promise<FaceModel>;
  getAllFaceModels(): Promise<FaceModel[]>;
  getFaceModel(id: string): Promise<FaceModel | undefined>;
  deleteFaceModel(id: string): Promise<void>;
  updateFaceModel(id: string, updates: Partial<FaceModel>): Promise<FaceModel>;

  // Photo matching sessions
  createPhotoMatchingSession(session: InsertPhotoMatchingSession): Promise<PhotoMatchingSession>;
  getPhotoMatchingSession(id: string): Promise<PhotoMatchingSession | undefined>;
  getActivePhotoMatchingSession(tcNumber: string): Promise<PhotoMatchingSession | undefined>;
  updatePhotoMatchingSession(id: string, updates: Partial<PhotoMatchingSession>): Promise<PhotoMatchingSession>;
  
  // Face model matching results
  createFaceModelMatchingResult(result: InsertFaceModelMatchingResult): Promise<FaceModelMatchingResult>;
  getFaceModelMatchingResults(sessionId: string): Promise<FaceModelMatchingResult[]>;
  getFaceModelMatchingResult(sessionId: string, modelId: string): Promise<FaceModelMatchingResult | undefined>;
  markResultAsDownloaded(resultId: string): Promise<void>;
  
  // System settings
  getSystemSetting(key: string, defaultValue: string): Promise<string>;
  updateSystemSetting(key: string, value: string): Promise<void>;
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

  // Menu settings operations
  async getMenuSettings(): Promise<MenuSettings | undefined> {
    const [settings] = await db.select().from(menuSettings).limit(1);
    return settings || undefined;
  }

  async updateMenuSettings(settingsData: InsertMenuSettings): Promise<MenuSettings> {
    const existingSettings = await this.getMenuSettings();
    
    if (existingSettings) {
      const [updated] = await db
        .update(menuSettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(menuSettings.id, existingSettings.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(menuSettings)
        .values(settingsData)
        .returning();
      return created;
    }
  }

  // Program events operations
  async createProgramEvent(event: InsertProgramEvent): Promise<ProgramEvent> {
    const [newEvent] = await db
      .insert(programEvents)
      .values(event)
      .returning();
    return newEvent;
  }

  async getAllProgramEvents(): Promise<ProgramEvent[]> {
    return db
      .select()
      .from(programEvents)
      .where(eq(programEvents.isActive, true))
      .orderBy(asc(programEvents.eventDate));
  }

  async updateProgramEvent(id: string, updates: Partial<InsertProgramEvent>): Promise<ProgramEvent> {
    const [updated] = await db
      .update(programEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(programEvents.id, id))
      .returning();
    return updated;
  }

  async deleteProgramEvent(id: string): Promise<void> {
    await db
      .update(programEvents)
      .set({ isActive: false })
      .where(eq(programEvents.id, id));
  }

  // Social media accounts operations
  async createSocialMediaAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount> {
    const [newAccount] = await db
      .insert(socialMediaAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async getAllSocialMediaAccounts(): Promise<SocialMediaAccount[]> {
    return db
      .select()
      .from(socialMediaAccounts)
      .where(eq(socialMediaAccounts.isActive, true))
      .orderBy(asc(socialMediaAccounts.displayOrder));
  }

  async updateSocialMediaAccount(id: string, updates: Partial<InsertSocialMediaAccount>): Promise<SocialMediaAccount> {
    const [updated] = await db
      .update(socialMediaAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(socialMediaAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteSocialMediaAccount(id: string): Promise<void> {
    await db
      .update(socialMediaAccounts)
      .set({ isActive: false })
      .where(eq(socialMediaAccounts.id, id));
  }

  // Team members operations
  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [newMember] = await db
      .insert(teamMembers)
      .values(member)
      .returning();
    return newMember;
  }

  async getAllTeamMembers(): Promise<TeamMember[]> {
    return db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.isActive, true))
      .orderBy(asc(teamMembers.displayOrder));
  }

  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember> {
    const [updated] = await db
      .update(teamMembers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teamMembers.id, id))
      .returning();
    return updated;
  }

  async deleteTeamMember(id: string): Promise<void> {
    await db
      .update(teamMembers)
      .set({ isActive: false })
      .where(eq(teamMembers.id, id));
  }

  // File upload operations
  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const [newFile] = await db
      .insert(uploadedFiles)
      .values(file)
      .returning();
    return newFile;
  }

  async getUploadedFile(id: string): Promise<UploadedFile | undefined> {
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, id));
    return file;
  }

  async getAllUploadedFiles(): Promise<UploadedFile[]> {
    return db
      .select()
      .from(uploadedFiles)
      .orderBy(desc(uploadedFiles.createdAt));
  }

  async deleteUploadedFile(id: string): Promise<void> {
    await db
      .delete(uploadedFiles)
      .where(eq(uploadedFiles.id, id));
  }

  // Page layout operations
  async createPageLayout(layout: InsertPageLayout): Promise<PageLayout> {
    const [newLayout] = await db
      .insert(pageLayouts)
      .values(layout)
      .returning();
    return newLayout;
  }

  async getPageLayout(id: string): Promise<PageLayoutWithFiles | undefined> {
    const [layout] = await db
      .select({
        id: pageLayouts.id,
        name: pageLayouts.name,
        backgroundImageDesktop: pageLayouts.backgroundImageDesktop,
        backgroundImageMobile: pageLayouts.backgroundImageMobile,
        backgroundPosition: pageLayouts.backgroundPosition,
        backgroundSize: pageLayouts.backgroundSize,
        backgroundColor: pageLayouts.backgroundColor,
        isActive: pageLayouts.isActive,
        createdAt: pageLayouts.createdAt,
        updatedAt: pageLayouts.updatedAt,
        backgroundImageDesktopFile: uploadedFiles,
      })
      .from(pageLayouts)
      .leftJoin(uploadedFiles, eq(pageLayouts.backgroundImageDesktop, uploadedFiles.id))
      .where(eq(pageLayouts.id, id));

    if (layout) {
      const elements = await this.getPageElementsByLayout(id);
      return { ...layout, elements };
    }
    return undefined;
  }

  async getActivePageLayout(): Promise<PageLayoutWithFiles | undefined> {
    const [layout] = await db
      .select()
      .from(pageLayouts)
      .where(eq(pageLayouts.isActive, true))
      .limit(1);

    if (layout) {
      return this.getPageLayout(layout.id);
    }
    return undefined;
  }

  async getAllPageLayouts(): Promise<PageLayoutWithFiles[]> {
    const layouts = await db
      .select()
      .from(pageLayouts)
      .orderBy(desc(pageLayouts.createdAt));

    const layoutsWithFiles = await Promise.all(
      layouts.map(async (layout) => {
        const elements = await this.getPageElementsByLayout(layout.id);
        return { ...layout, elements };
      })
    );

    return layoutsWithFiles;
  }

  async updatePageLayout(id: string, updates: Partial<InsertPageLayout>): Promise<PageLayout> {
    const [updated] = await db
      .update(pageLayouts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pageLayouts.id, id))
      .returning();
    return updated;
  }

  async deletePageLayout(id: string): Promise<void> {
    await db
      .delete(pageElements)
      .where(eq(pageElements.layoutId, id));
    await db
      .delete(pageLayouts)
      .where(eq(pageLayouts.id, id));
  }

  // Page element operations
  async createPageElement(element: InsertPageElement): Promise<PageElement> {
    const [newElement] = await db
      .insert(pageElements)
      .values(element)
      .returning();
    return newElement;
  }

  async getPageElement(id: string): Promise<PageElement | undefined> {
    const [element] = await db
      .select()
      .from(pageElements)
      .where(eq(pageElements.id, id));
    return element;
  }

  async getPageElementsByLayout(layoutId: string): Promise<PageElement[]> {
    return db
      .select()
      .from(pageElements)
      .where(and(eq(pageElements.layoutId, layoutId), eq(pageElements.isVisible, true)))
      .orderBy(asc(pageElements.displayOrder));
  }

  async updatePageElement(id: string, updates: Partial<InsertPageElement>): Promise<PageElement> {
    const [updated] = await db
      .update(pageElements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pageElements.id, id))
      .returning();
    return updated;
  }

  async deletePageElement(id: string): Promise<void> {
    await db
      .delete(pageElements)
      .where(eq(pageElements.id, id));
  }

  async updateElementPosition(id: string, positionX: number, positionY: number): Promise<void> {
    await db
      .update(pageElements)
      .set({ positionX, positionY, updatedAt: new Date() })
      .where(eq(pageElements.id, id));
  }
  
  // Photo management operations
  async createPhotoRequest(insertRequest: InsertPhotoRequest): Promise<PhotoRequest> {
    const [request] = await db
      .insert(photoRequests)
      .values(insertRequest)
      .returning();
    return request;
  }

  async getPhotoRequest(id: string): Promise<PhotoRequest | undefined> {
    const [request] = await db.select().from(photoRequests).where(eq(photoRequests.id, id));
    return request || undefined;
  }

  async getPhotoRequestByTc(tcNumber: string): Promise<PhotoRequest | undefined> {
    const [request] = await db.select().from(photoRequests).where(eq(photoRequests.tcNumber, tcNumber));
    return request || undefined;
  }

  async updatePhotoRequest(id: string, updates: Partial<InsertPhotoRequest>): Promise<PhotoRequest> {
    const [request] = await db
      .update(photoRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(photoRequests.id, id))
      .returning();
    return request;
  }

  async getAllPhotoRequests(): Promise<PhotoRequestWithDetails[]> {
    const result = await db
      .select({
        id: photoRequests.id,
        tcNumber: photoRequests.tcNumber,
        email: photoRequests.email,
        status: photoRequests.status,
        referencePhotoPath: photoRequests.referencePhotoPath,
        selectedFaceId: photoRequests.selectedFaceId,
        faceData: photoRequests.faceData,
        processedAt: photoRequests.processedAt,
        emailSentAt: photoRequests.emailSentAt,
        matchedPhotosCount: photoRequests.matchedPhotosCount,
        errorMessage: photoRequests.errorMessage,
        createdAt: photoRequests.createdAt,
        updatedAt: photoRequests.updatedAt,
        detectedFacesCount: count(detectedFaces.id),
        queuePosition: processingQueue.queuePosition,
      })
      .from(photoRequests)
      .leftJoin(detectedFaces, eq(photoRequests.id, detectedFaces.photoRequestId))
      .leftJoin(processingQueue, eq(photoRequests.id, processingQueue.photoRequestId))
      .groupBy(photoRequests.id, processingQueue.queuePosition)
      .orderBy(desc(photoRequests.createdAt));
    
    // Her request için seçilen kamp günlerini ayrıca getir ve sonucu PhotoRequestWithDetails formatına çevir
    const enhancedResult: PhotoRequestWithDetails[] = [];
    
    for (const request of result) {
      const selectedDays = await db
        .select({
          campDayId: photoRequestDays.campDayId,
        })
        .from(photoRequestDays)
        .where(eq(photoRequestDays.photoRequestId, request.id));
      
      // PhotoRequestWithDetails formatına çevir
      const enhancedRequest: PhotoRequestWithDetails = {
        ...request,
        queuePosition: request.queuePosition ?? undefined,
        selectedCampDays: selectedDays.map(day => day.campDayId),
      };
      
      enhancedResult.push(enhancedRequest);
    }
    
    return enhancedResult;
  }

  // Detected faces operations
  async createDetectedFace(insertFace: InsertDetectedFace): Promise<DetectedFace> {
    const [face] = await db
      .insert(detectedFaces)
      .values(insertFace)
      .returning();
    return face;
  }

  async getDetectedFacesByRequest(photoRequestId: string): Promise<DetectedFace[]> {
    return db.select().from(detectedFaces).where(eq(detectedFaces.photoRequestId, photoRequestId));
  }

  async updateDetectedFace(id: string, updates: Partial<InsertDetectedFace>): Promise<DetectedFace> {
    const [face] = await db
      .update(detectedFaces)
      .set(updates)
      .where(eq(detectedFaces.id, id))
      .returning();
    return face;
  }

  async selectDetectedFace(photoRequestId: string, faceId: string): Promise<void> {
    // Önce tüm yüzleri seçilmemiş yap
    await db
      .update(detectedFaces)
      .set({ isSelected: false })
      .where(eq(detectedFaces.photoRequestId, photoRequestId));
    
    // Seçilen yüzü işaretle
    await db
      .update(detectedFaces)
      .set({ isSelected: true })
      .where(eq(detectedFaces.id, faceId));
    
    // PhotoRequest'teki selectedFaceId'yi güncelle
    await db
      .update(photoRequests)
      .set({ selectedFaceId: faceId, updatedAt: new Date() })
      .where(eq(photoRequests.id, photoRequestId));
  }

  // Photo database operations
  async createPhotoDatabase(insertPhoto: InsertPhotoDatabase): Promise<PhotoDatabase> {
    const [photo] = await db
      .insert(photoDatabase)
      .values(insertPhoto)
      .returning();
    return photo;
  }

  async getAllPhotosInDatabase(): Promise<PhotoDatabaseWithDetails[]> {
    const result = await db
      .select({
        id: photoDatabase.id,
        fileName: photoDatabase.fileName,
        filePath: photoDatabase.filePath,
        originalName: photoDatabase.originalName,
        fileSize: photoDatabase.fileSize,
        mimeType: photoDatabase.mimeType,
        uploadedBy: photoDatabase.uploadedBy,
        isProcessed: photoDatabase.isProcessed,
        faceCount: photoDatabase.faceCount,
        processingError: photoDatabase.processingError,
        createdAt: photoDatabase.createdAt,
        updatedAt: photoDatabase.updatedAt,
        uploadedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        matchesCount: count(photoMatches.id),
      })
      .from(photoDatabase)
      .leftJoin(users, eq(photoDatabase.uploadedBy, users.id))
      .leftJoin(photoMatches, eq(photoDatabase.id, photoMatches.photoDatabaseId))
      .groupBy(photoDatabase.id, users.firstName, users.lastName)
      .orderBy(desc(photoDatabase.createdAt));
    
    return result;
  }

  async updatePhotoDatabase(id: string, updates: Partial<InsertPhotoDatabase>): Promise<PhotoDatabase> {
    const [photo] = await db
      .update(photoDatabase)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(photoDatabase.id, id))
      .returning();
    return photo;
  }

  async deletePhotoFromDatabase(id: string): Promise<void> {
    await db.delete(photoDatabase).where(eq(photoDatabase.id, id));
  }

  // Photo matches operations
  async createPhotoMatch(insertMatch: InsertPhotoMatch): Promise<PhotoMatch> {
    const [match] = await db
      .insert(photoMatches)
      .values(insertMatch)
      .returning();
    return match;
  }

  async getPhotoMatchesByRequest(photoRequestId: string): Promise<PhotoMatchWithDetails[]> {
    const result = await db
      .select({
        id: photoMatches.id,
        photoRequestId: photoMatches.photoRequestId,
        photoDatabaseId: photoMatches.photoDatabaseId,
        similarityScore: photoMatches.similarityScore,
        matchedFaceBox: photoMatches.matchedFaceBox,
        isEmailSent: photoMatches.isEmailSent,
        createdAt: photoMatches.createdAt,
        photoFileName: photoDatabase.fileName,
        photoFilePath: photoDatabase.filePath,
      })
      .from(photoMatches)
      .leftJoin(photoDatabase, eq(photoMatches.photoDatabaseId, photoDatabase.id))
      .where(eq(photoMatches.photoRequestId, photoRequestId))
      .orderBy(desc(photoMatches.createdAt));
    
    return result;
  }

  async markMatchEmailSent(matchId: string): Promise<void> {
    await db
      .update(photoMatches)
      .set({ isEmailSent: true })
      .where(eq(photoMatches.id, matchId));
  }

  // Processing queue operations
  async addToProcessingQueue(insertQueue: InsertProcessingQueue): Promise<ProcessingQueue> {
    const [queueItem] = await db
      .insert(processingQueue)
      .values(insertQueue)
      .returning();
    return queueItem;
  }

  async getNextInQueue(): Promise<ProcessingQueueWithDetails | undefined> {
    const [nextItem] = await db
      .select({
        id: processingQueue.id,
        photoRequestId: processingQueue.photoRequestId,
        queuePosition: processingQueue.queuePosition,
        startedAt: processingQueue.startedAt,
        completedAt: processingQueue.completedAt,
        progress: processingQueue.progress,
        currentStep: processingQueue.currentStep,
        createdAt: processingQueue.createdAt,
        tcNumber: photoRequests.tcNumber,
        email: photoRequests.email,
      })
      .from(processingQueue)
      .leftJoin(photoRequests, eq(processingQueue.photoRequestId, photoRequests.id))
      .where(sql`${processingQueue.startedAt} IS NULL`)
      .orderBy(processingQueue.queuePosition)
      .limit(1);
    
    return nextItem || undefined;
  }

  async updateQueueProgress(id: string, progress: number, currentStep: string): Promise<void> {
    await db
      .update(processingQueue)
      .set({ progress, currentStep })
      .where(eq(processingQueue.id, id));
  }

  async completeQueueItem(id: string): Promise<void> {
    await db
      .update(processingQueue)
      .set({ completedAt: new Date(), progress: 100 })
      .where(eq(processingQueue.id, id));
  }

  async getQueueStatus(): Promise<ProcessingQueueWithDetails[]> {
    const result = await db
      .select({
        id: processingQueue.id,
        photoRequestId: processingQueue.photoRequestId,
        queuePosition: processingQueue.queuePosition,
        startedAt: processingQueue.startedAt,
        completedAt: processingQueue.completedAt,
        progress: processingQueue.progress,
        currentStep: processingQueue.currentStep,
        createdAt: processingQueue.createdAt,
        tcNumber: photoRequests.tcNumber,
        email: photoRequests.email,
      })
      .from(processingQueue)
      .leftJoin(photoRequests, eq(processingQueue.photoRequestId, photoRequests.id))
      .orderBy(processingQueue.queuePosition);
    
    return result;
  }

  // Camp days operations
  async getAllCampDays(): Promise<CampDay[]> {
    return db.select().from(campDays).where(eq(campDays.isActive, true)).orderBy(campDays.dayDate);
  }

  async createCampDay(insertCampDay: InsertCampDay): Promise<CampDay> {
    const [campDay] = await db
      .insert(campDays)
      .values(insertCampDay)
      .returning();
    return campDay;
  }

  async updateCampDay(id: string, updates: Partial<InsertCampDay>): Promise<CampDay> {
    const [campDay] = await db
      .update(campDays)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(campDays.id, id))
      .returning();
    return campDay;
  }

  async deleteCampDay(id: string): Promise<void> {
    await db.delete(campDays).where(eq(campDays.id, id));
  }

  async deleteAllCampDays(): Promise<void> {
    await db.delete(campDays);
  }

  // Photo request days operations
  async createPhotoRequestDay(insertRequestDay: InsertPhotoRequestDay): Promise<PhotoRequestDay> {
    const [requestDay] = await db
      .insert(photoRequestDays)
      .values(insertRequestDay)
      .returning();
    return requestDay;
  }

  async getPhotoRequestDays(photoRequestId: string): Promise<CampDay[]> {
    const result = await db
      .select({
        id: campDays.id,
        dayName: campDays.dayName,
        dayDate: campDays.dayDate,
        modelPath: campDays.modelPath,
        modelStatus: campDays.modelStatus,
        photoCount: campDays.photoCount,
        faceCount: campDays.faceCount,
        lastTrainedAt: campDays.lastTrainedAt,
        isActive: campDays.isActive,
        createdAt: campDays.createdAt,
        updatedAt: campDays.updatedAt,
      })
      .from(photoRequestDays)
      .innerJoin(campDays, eq(photoRequestDays.campDayId, campDays.id))
      .where(eq(photoRequestDays.photoRequestId, photoRequestId));
    return result;
  }

  async deletePhotoRequestDays(photoRequestId: string): Promise<void> {
    await db.delete(photoRequestDays).where(eq(photoRequestDays.photoRequestId, photoRequestId));
  }

  // Face models operations
  async createFaceModel(insertModel: CreateFaceModel): Promise<FaceModel> {
    const [model] = await db
      .insert(faceModels)
      .values([insertModel])
      .returning();
    return model;
  }

  async getAllFaceModels(): Promise<FaceModel[]> {
    return db.select().from(faceModels).orderBy(desc(faceModels.createdAt));
  }

  async getFaceModel(id: string): Promise<FaceModel | undefined> {
    const [model] = await db.select().from(faceModels).where(eq(faceModels.id, id));
    return model || undefined;
  }

  async deleteFaceModel(id: string): Promise<void> {
    await db.delete(faceModels).where(eq(faceModels.id, id));
  }

  async updateFaceModel(id: string, updates: Partial<FaceModel>): Promise<FaceModel> {
    const [model] = await db
      .update(faceModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(faceModels.id, id))
      .returning();
    return model;
  }

  // Photo matching sessions operations
  async createPhotoMatchingSession(insertSession: InsertPhotoMatchingSession): Promise<PhotoMatchingSession> {
    const [session] = await db
      .insert(photoMatchingSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getPhotoMatchingSessionByTc(tcNumber: string): Promise<PhotoMatchingSession | undefined> {
    const [session] = await db.select().from(photoMatchingSessions).where(eq(photoMatchingSessions.tcNumber, tcNumber));
    return session || undefined;
  }

  async deletePhotoMatchingSession(sessionId: string): Promise<void> {
    await db.delete(photoMatchingSessions).where(eq(photoMatchingSessions.id, sessionId));
  }

  async getPhotoMatchingSession(id: string): Promise<PhotoMatchingSession | undefined> {
    const [session] = await db.select().from(photoMatchingSessions).where(eq(photoMatchingSessions.id, id));
    return session || undefined;
  }

  async getActivePhotoMatchingSession(tcNumber: string): Promise<PhotoMatchingSession | undefined> {
    const [session] = await db
      .select()
      .from(photoMatchingSessions)
      .where(
        and(
          eq(photoMatchingSessions.tcNumber, tcNumber),
          sql`${photoMatchingSessions.timeoutAt} > NOW()`
        )
      )
      .orderBy(desc(photoMatchingSessions.createdAt));
    return session || undefined;
  }

  async updatePhotoMatchingSession(id: string, updates: Partial<PhotoMatchingSession>): Promise<PhotoMatchingSession> {
    const [session] = await db
      .update(photoMatchingSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(photoMatchingSessions.id, id))
      .returning();
    return session;
  }

  // Face model matching results operations
  async createFaceModelMatchingResult(insertResult: InsertFaceModelMatchingResult): Promise<FaceModelMatchingResult> {
    const [result] = await db
      .insert(faceModelMatchingResults)
      .values(insertResult)
      .returning();
    return result;
  }

  async getFaceModelMatchingResults(sessionId: string): Promise<FaceModelMatchingResult[]> {
    return db
      .select()
      .from(faceModelMatchingResults)
      .where(eq(faceModelMatchingResults.sessionId, sessionId))
      .orderBy(faceModelMatchingResults.createdAt);
  }

  async getFaceModelMatchingResult(sessionId: string, modelId: string): Promise<FaceModelMatchingResult | undefined> {
    const [result] = await db
      .select()
      .from(faceModelMatchingResults)
      .where(
        and(
          eq(faceModelMatchingResults.sessionId, sessionId),
          eq(faceModelMatchingResults.faceModelId, modelId)
        )
      );
    return result || undefined;
  }

  async markResultAsDownloaded(resultId: string): Promise<void> {
    await db
      .update(faceModelMatchingResults)
      .set({ downloadedAt: new Date() })
      .where(eq(faceModelMatchingResults.id, resultId));
  }

  // System settings operations
  async getSystemSetting(key: string, defaultValue: string): Promise<string> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, key));
    return setting?.settingValue || defaultValue;
  }

  async updateSystemSetting(key: string, value: string): Promise<void> {
    await db
      .insert(systemSettings)
      .values({ settingKey: key, settingValue: value })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: { settingValue: value, updatedAt: new Date() }
      });
  }
}

export const storage = new DatabaseStorage();
