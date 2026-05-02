import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestContext } from './common/middleware';
import { errorHandler } from './common/middleware';
import healthRouter from './common/routes/health';
import authRouter from './auth/routes/auth.routes';
import branchRouter from './branch/routes/branch.routes';
import userRouter from './user/routes/user.routes';
import caseRouter from './case/routes/case.routes';
import lookupRouter from './common/routes/lookup.routes';
import auditRouter from './audit/routes/audit.routes';
import noticeRouter from './notice/routes/notice.routes';
import documentRouter from './document/routes/document.routes';
import dashboardRouter from './branch/routes/dashboard.routes';
import officeRouter from './office/routes/office.routes';
import banksRouter from './branch/routes/banks.routes';
import inviteRouter from './user/routes/invite.routes';
import appAdminRouter from './app-admin/routes/appAdmin.routes';
import bankOversightRouter from './bank-oversight/routes/bankOversight.routes';

const app = express();

// Security headers
app.use(helmet());

// CORS — allow frontend dev server
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Attach request context (userId, branchId, role from JWT — populated by auth middleware)
app.use(requestContext);

// Routes
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', branchRouter);
app.use('/api', userRouter);
app.use('/api', caseRouter);
app.use('/api', lookupRouter);
app.use('/api', auditRouter);
app.use('/api', noticeRouter);
app.use('/api', documentRouter);
app.use('/api', dashboardRouter);
app.use('/api', officeRouter);
app.use('/api', banksRouter);
app.use('/api', inviteRouter);
app.use('/api', appAdminRouter);
app.use('/api', bankOversightRouter);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
