# AK Parti Gençlik Kolları İstişare Kampı Yönetim Sistemi

## Overview

This is a web-based management system for the AK Party Youth Branches Consultation Camp. The application is designed to facilitate question and answer management with role-based access control for administrators and moderators.

## User Preferences

Preferred communication style: Turkish language, simple everyday communication.
The user requested all communications to be in Turkish.

## Recent Changes

### January 28, 2025
- **Role Renaming Completed**: Successfully renamed all user roles throughout the entire codebase:
  - "adminpro" → "genelsekreterlik" (General Secretariat)
  - "admin" → "genelbaskan" (General President)
  - "moderator" remains as "moderator"
- Updated all database references, API endpoints, UI components, and role checks
- Updated documentation to reflect new Turkish organizational structure

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **Routing**: Wouter for client-side routing
- **UI Framework**: Shadcn/UI components with Radix UI primitives
- **Styling**: Tailwind CSS with custom AK Party brand colors
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: Stateless JWT-based authentication

### Key Design Decisions
- **Monorepo Structure**: Client and server code in the same repository with shared schema
- **TypeScript First**: Full TypeScript implementation across frontend, backend, and shared code
- **Component-Based UI**: Reusable UI components following atomic design principles
- **Role-Based Access**: Three distinct user roles with different permissions and UI experiences

## Key Components

### User Roles and Permissions
1. **Genel Sekreterlik (genelsekreterlik)**: Full system access including user management, question management, feedback viewing, and system logs
2. **Genel Başkan (genelbaskan)**: Can view reports and system logs, access all table responses
3. **Moderatör (moderator)**: Table-specific access to assigned questions, can create/edit answers and send feedback

### Core Entities
- **Users**: Authentication and role management
- **Tables**: Organization units for moderators
- **Questions**: Can be general (all tables) or specific (assigned tables)
- **Answers**: Multiple answers per question per table
- **Feedback**: Moderator feedback to administrators
- **Activity Logs**: System activity tracking

### Authentication System
- TC Kimlik Numarası (Turkish ID) based login
- JWT token authentication with 24-hour expiration
- Role-based route protection
- Activity logging for all user actions

## Data Flow

### Authentication Flow
1. User enters TC number and password
2. Server validates credentials and returns JWT token
3. Token stored in localStorage for subsequent requests
4. Middleware validates token on protected routes

### Question Management Flow
1. Genel Sekreterlik creates questions (general or table-specific)
2. Questions distributed to appropriate moderators
3. Moderators provide multiple answers per question
4. Administrators can view all responses and generate reports

### Feedback System
1. Moderators can send feedback about questions
2. Feedback includes context about unclear questions or missing information
3. AdminPro users can view and manage feedback

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connection
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI component primitives
- **drizzle-orm**: Type-safe SQL query builder
- **jwt/bcrypt**: Authentication and password security
- **zod**: Runtime type validation

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type checking and compilation
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Production bundling

## Deployment Strategy

### Build Process
- Frontend: Vite builds React app to `dist/public`
- Backend: ESBuild bundles server code to `dist/index.js`
- Single deployment artifact with static file serving

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JWT_SECRET`: JWT signing secret (fallback provided)
- `NODE_ENV`: Environment mode (development/production)

### Database Setup
- Drizzle Kit for schema migrations
- PostgreSQL with UUID primary keys
- Enum types for roles and question types
- JSONB for flexible data storage (table assignments)

### Special Features
- **Splash Screen**: 3-second animated loading screen on first visit
- **Mobile Responsive**: Tailwind CSS responsive design
- **Turkish Localization**: All UI text in Turkish
- **Brand Colors**: Custom AK Party yellow and blue theme
- **Activity Logging**: Comprehensive user action tracking
- **Role-Based Navigation**: Dynamic sidebar based on user permissions

The application follows a clean separation of concerns with shared TypeScript types between client and server, ensuring type safety across the full stack.