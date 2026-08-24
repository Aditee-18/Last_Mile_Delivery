import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/order.enums.js';

/**
 * Middleware Factory: Role-Based Access Control (RBAC)
 * Enforces that req.user.role matches one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access. User identity not verified.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden access. Required role: [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}
